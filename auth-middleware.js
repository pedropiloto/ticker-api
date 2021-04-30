module.exports = (req, res, next) => {
  const api_key = req.headers['api-key']
  if (!!process.env.API_KEY && api_key !== process.env.API_KEY) {
    res.status(401).json({
      error: 'Unauthorized'
    });
  } else {
    next();
  }
};