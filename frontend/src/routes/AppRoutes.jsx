import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import Resources from '../pages/Resources/Resources';
import UserLayout from '../layouts/UserLayout/UserLayout';
import PrivateRoute from './PrivateRoute';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <PrivateRoute>
              <UserLayout />
            </PrivateRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/resources" element={<Resources />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;