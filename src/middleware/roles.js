import prisma from '../loaders/prisma.js';
function roleMiddleware(allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: userId missing" });
      }

      console.log("unothorized from roles")

      // Fetch roles from DB (to always get the latest roles)
      const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!userWithRoles) {
        return res.status(404).json({ message: "User not found" });
      }

      // Extract actual role names (RoleType enums)
      const userRoles = userWithRoles.userRoles.map(ur => ur.role.name);

      // Check if user has at least one allowed role
      const hasAccess = userRoles.some(r => allowedRoles.includes(r));

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied: insufficient role" });
      }

      // Attach roles to req for later usage
      req.user.roles = userRoles;

      console.log("pass from roles")

      next();
    } catch (err) {
      console.error("RoleMiddleware error:", err);
      res.status(500).json({ message: "Internal server error in roleMiddleware" });
    }
  };
}

export default roleMiddleware;
