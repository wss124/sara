import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Home from '../pages/Home/Home';
import Resources from '../pages/Resources/Resources';
import Requests from '../pages/Requests/Requests';
import Approvals from '../pages/Approvals/Approvals';
import Users from '../pages/Users/Users';
import Handovers from '../pages/Handovers/Handovers';
import UserLayout from '../layouts/UserLayout/UserLayout';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';
import UserRoute from './UserRoute';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <PrivateRoute>
              <UserLayout />
            </PrivateRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/resources" element={<Resources />} />
          <Route
            path="/requests"
            element={
              <UserRoute>
                <Requests />
              </UserRoute>
            }
          />
          <Route
            path="/approvals"
            element={
              <AdminRoute>
                <Approvals />
              </AdminRoute>
            }
          />
          <Route
            path="/handovers"
            element={
              <AdminRoute>
                <Handovers />
              </AdminRoute>
            }
          />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;