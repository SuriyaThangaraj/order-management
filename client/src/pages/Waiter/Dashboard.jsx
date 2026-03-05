import { Routes, Route } from 'react-router-dom';
import TableSelect from './TableSelect';
import OrderPad from './OrderPad';
import WaiterShortCodes from './WaiterShortCodes';

const WaiterDashboard = () => {
    return (
        <div style={{ background: 'var(--bg-light)', minHeight: '100vh' }}>
            <Routes>
                <Route path="/" element={<TableSelect />} />
                <Route path="/table/:tableNo" element={<OrderPad />} />
                <Route path="/short-codes" element={<WaiterShortCodes />} />
            </Routes>
        </div>
    );
};

export default WaiterDashboard;
