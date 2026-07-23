export const errorHandler = (err, req, res, next) => {
  const detail = err.response?.data?.detail || err.response?.data || err.message || err;
  console.error('Error in Node backend:', detail);
  const statusCode = err.response?.status || (res.statusCode === 200 ? 500 : res.statusCode);
  res.status(statusCode).json({
    message: typeof detail === 'string' ? detail : err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
