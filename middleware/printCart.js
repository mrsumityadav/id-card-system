module.exports.ensureCart = (req, res, next) => {
  if (!req.session.printCart) {
    req.session.printCart = [];
  }
  next();
};