// const isAdmin = (req, res, next) => {
//   if (req.user && req.user.role === 'admin') {
//     next();
//   } else {
//     return res.status(403).json({
//       message: 'Access denied',
//       data: null,
//       error: 'Admin access required'
//     });
//   }
// };

// module.exports = isAdmin;