const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create new order (WAITER)
// @route   POST /api/orders
// @access  Private (Waiter)
router.post('/', protect, async (req, res) => {
    const { tableNo, items, totalAmount } = req.body;

    if (items && items.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    } else {
        const order = new Order({
            tableNo,
            waiterId: req.user._id,
            items,
            totalAmount,
            status: 'SENT',
            orderSource: 'WAITER',
            status: 'SENT',
            orderSource: 'WAITER',
            adminId: req.user.adminId || req.user._id, // Legacy
        });

        const createdOrder = await order.save();
        await createdOrder.populate('waiterId', 'username');

        const io = req.app.get('io');
        io.emit('newOrder', createdOrder);

        res.status(201).json(createdOrder);
    }
});

// @desc    Create new order (CUSTOMER - Public)
// @route   POST /api/orders/customer
// @access  Public
router.post('/customer', async (req, res) => {
    const { tableNo, items, totalAmount, note, voiceNoteUrl, waiterId } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    }

    // Need to find Admin ID from the Waiter ID
    // Assumption: Client sends valid waiterId. If not, this is tricky.
    // For now, assume waiterId is present (QR code should have it)

    // Need to find Admin ID (Tenant Context)
    // Legacy Admin ID resolution if needed
    let adminId = req.body.adminId;
    if (!adminId && waiterId) {
        const user = await User.findById(waiterId);
        if (user) adminId = user.adminId;
    }

    const order = new Order({
        tableNo,
        items,
        totalAmount,
        note,
        voiceNoteUrl,
        status: 'PENDING_APPROVAL',
        orderSource: 'CUSTOMER',
        waiterId: waiterId,
        waiterId: waiterId,
        adminId: adminId, // Legacy
    });

    const createdOrder = await order.save();

    const io = req.app.get('io');

    // LOGIC: Explicit waiter wins. If not, look for existing waiter.
    let targetWaiterId = waiterId;

    if (!targetWaiterId) {
        try {
            const existingOrder = await Order.findOne({
                tableNo: tableNo,
                status: { $ne: 'PAID' },
                waiterId: { $exists: true, $ne: null }
            }).sort({ createdAt: -1 });

            if (existingOrder) {
                targetWaiterId = existingOrder.waiterId;
            }
        } catch (e) {
            console.error("Error finding existing waiter:", e);
        }
    }

    // Notify Waiters about the request (Client will filter if targetWaiterId is set)
    // We need to route this to the specific tenant (adminId).
    // The waiter/kitchen/admin will be in room = adminId.
    io.emit('newCustomerRequest', { ...createdOrder.toObject(), targetWaiterId });

    res.status(201).json(createdOrder);
});

// @desc    Get all orders for a specific table (CUSTOMER - Public)
// @route   GET /api/orders/customer/:tableNo
// @access  Public
router.get('/customer/:tableNo', async (req, res) => {
    try {
        // Must provide context
        const orders = await Order.find({
            tableNo: req.params.tableNo,
            status: { $ne: 'PAID' }
        }).sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all orders (with filtering options if needed)
// @route   GET /api/orders
// @access  Private (Kitchen/Admin)
router.get('/', protect, async (req, res) => {
    // If Kitchen, maybe only show active orders? For now return all non-PAID for kitchen? or query params
    // Let's return all active orders (not PAID) by default for Kitchen display, or support status query

    // Let's return all active orders (not PAID) by default for Kitchen display, or support status query

    // REMOVED TENANT ISOLATION
    let query = {}; // { tenantId: req.tenantId };
    if (req.query.status) {
        if (req.query.status === 'active') {
            query.status = { $ne: 'PAID' };
        } else {
            query.status = req.query.status;
        }
    }

    const orders = await Order.find(query).populate('waiterId', 'username').sort({ createdAt: -1 });
    res.json(orders);
});

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private (Kitchen/Waiter)
router.put('/:id', protect, async (req, res) => {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (order) {
        const oldStatus = order.status;
        order.status = status;

        // If approving a customer order, add the waiter ID who approved it
        if (oldStatus === 'PENDING_APPROVAL' && status === 'SENT') {
            order.waiterId = req.user._id;
            order.orderSource = 'WAITER'; // treat as verified waiter order now? or keep CUSTOMER source but VERIFIED? 
            // Let's keep source CUSTOMER but it helps to know who approved.
        }

        // If status is changed to READY, delete voice note file and clear notes
        if (status === 'READY') {
            const fs = require('fs');
            const path = require('path');

            if (order.voiceNoteUrl) {
                try {
                    // voiceNoteUrl e.g. /uploads/filename.webm
                    // Remove leading slash for safe join via path.join
                    const relativePath = order.voiceNoteUrl.startsWith('/') ? order.voiceNoteUrl.slice(1) : order.voiceNoteUrl;
                    const filePath = path.join(__dirname, '..', relativePath);

                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log("Deleted voice note:", filePath);
                    }
                } catch (err) {
                    console.error("Error deleting voice note file:", err);
                }
                order.voiceNoteUrl = null;
            }
            // Clear text note as well
            if (order.note) {
                order.note = null;
            }
        }

        const updatedOrder = await order.save();
        if (updatedOrder.waiterId) {
            await updatedOrder.populate('waiterId', 'username');
        }

        const io = req.app.get('io');

        // If status changed to SENT (Approved), notify Kitchen
        if (oldStatus === 'PENDING_APPROVAL' && status === 'SENT') {
            io.emit('newOrder', updatedOrder);
        } else {
            io.emit('orderStatusUpdated', updatedOrder);
        }

        // Also notify customer (we can use tableNo room or generic update)
        io.emit('customerOrderUpdated', updatedOrder);

        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// @desc    Finish Table (Mark as PAID)
// @route   PUT /api/orders/finish/:tableNo
// @access  Private (Waiter)
router.put('/finish/:tableNo', protect, async (req, res) => {
    try {
        const { printBill } = req.body;
        const tableNo = req.params.tableNo;

        console.log(`[FINISH TABLE] Table: ${tableNo}, PrintBill: ${printBill}, User: ${req.user.username}`);

        // Fetch orders BEFORE updating status if we need to print
        let billDetails = null;

        // Always try to fetch bill details if printing is requested
        if (printBill) {
            const ordersToPrint = await Order.find({
                tableNo,
                status: { $ne: 'PAID' }
            });

            if (ordersToPrint && ordersToPrint.length > 0) {
                // Aggregate items for the bill
                const allItems = [];
                let grandTotal = 0;
                ordersToPrint.forEach(order => {
                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach(item => {
                            allItems.push({
                                name: item.name,
                                qty: item.qty,
                                price: item.price,
                                total: item.price * item.qty
                            });
                            grandTotal += (item.price * item.qty);
                        });
                    }
                });

                billDetails = {
                    tableNo,
                    items: allItems,
                    grandTotal,
                    waiterName: req.user.username,
                    timestamp: new Date()
                };
            }
        }

        // Update status to PAID (Global - no tenant isolation)
        const result = await Order.updateMany(
            {
                tableNo: req.params.tableNo,
                status: { $ne: 'PAID' }
                // tenantId: req.user.tenantId // REMOVED
            },
            { $set: { status: 'PAID' } }
        );

        const io = req.app.get('io');

        // Emit Printing Event if requested and we have details
        if (printBill && billDetails) {
            console.log("[FINISH TABLE] Emitting printBill event");
            io.emit('printBill', billDetails);
        } else if (printBill) {
            console.warn("[FINISH TABLE] Print requested but no bill details found (maybe no active orders?)");
        }

        // Notify that table is free
        io.emit('tableFinished', { tableNo: req.params.tableNo });

        res.json({ message: 'Table finished', updatedCount: result.modifiedCount });

    } catch (error) {
        console.error("[FINISH TABLE ERROR]", error);
        res.status(500).json({ message: 'Failed to finish table: ' + error.message });
    }
});

// @desc    Get Sales Analytics
// @route   GET /api/orders/analytics
// @access  Private (Admin)
const { admin } = require('../middleware/authMiddleware'); // Import admin middleware
router.get('/analytics', protect, admin, async (req, res) => {
    const totalOrders = await Order.countDocuments({});
    const unpaidOrders = await Order.countDocuments({ status: { $ne: 'PAID' } });

    const revenueAgg = await Order.aggregate([
        { $match: { status: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Top items
    const topItems = await Order.aggregate([
        // { $match: { } }, // Global match
        { $unwind: '$items' },
        { $group: { _id: '$items.name', count: { $sum: '$items.qty' } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);

    res.json({
        totalOrders,
        unpaidOrders,
        totalRevenue,
        topItems
    });
});

// @desc    Delete all READY orders
// @route   DELETE /api/orders/ready
// @access  Private (Kitchen/Admin)
router.delete('/ready', protect, async (req, res) => {
    try {
        const result = await Order.deleteMany({ status: 'READY' });

        const io = req.app.get('io');
        // Notify clients to refresh or remove these orders locally
        // We can just emit a generic 'ordersUpdated' or specific one
        io.emit('ordersCleared', { status: 'READY', count: result.deletedCount });

        res.json({ message: 'Ready orders cleared', count: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Reject/Delete Customer Request
// @route   DELETE /api/orders/:id
// @access  Private (Waiter)
router.delete('/:id', protect, async (req, res) => {
    try {
        // Enforce tenant isolation
        // REMOVED TENANT ISOLATION
        const order = await Order.findById(req.params.id);

        if (order) {
            if (order.status !== 'PENDING_APPROVAL') {
                return res.status(400).json({ message: 'Can only delete pending requests via this endpoint' });
            }

            await order.deleteOne();
            const io = req.app.get('io');
            // Notify customer their order was rejected
            io.emit('customerOrderRejected', { _id: req.params.id, tableNo: order.tableNo });

            res.json({ message: 'Order rejected' });
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
