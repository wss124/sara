import { Navigate } from "react-router-dom";

export default function PrivateRoute({children}){
    const isAuthenticated = localStorage.getItem('sara_auth') === 'true';

    if(!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    return children
}