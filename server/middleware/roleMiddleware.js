// backend/middleware/roleMiddleware.js
const roleMiddleware = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userRole = req.user.role;

        // If roles is an array, check if user's role is included
        // or if user is admin (admin should have access to all routes)
        if (Array.isArray(roles) && (roles.includes(userRole) || userRole === 'admin')) {
            return next();
        }

        return res.status(403).json({ 
            message: 'Access denied. Insufficient permissions.' 
        });
    };
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userRole = req.user.role;

        // Check if the user's role is included in the allowed roles
        // or if user is admin (admin should have access to all routes)
        if (allowedRoles.includes(userRole) || userRole === 'admin') {
            return next();
        }

        return res.status(403).json({ 
            message: 'Access denied. Insufficient permissions.' 
        });
    };
};

export { roleMiddleware, authorizeRoles };