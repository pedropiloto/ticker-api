module.exports = (req, res, next) => {
  const api_key = req.headers['api_key']
  console.log('api_key', api_key)
  console.log('process.env.API_KEY', process.env.API_KEY)
  if (!!process.env.API_KEY && api_key !== process.env.API_KEY) {
    res.status(401).json({
      error: 'Unauthorized'
    });
  } else {
    next();
  }
};