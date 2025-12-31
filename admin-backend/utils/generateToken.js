import jwt from 'jsonwebtoken';

const generateToken = (payload) => {
  // If payload is an object, use it directly; otherwise wrap in {id}
  const tokenPayload = typeof payload === 'object' ? payload : { id: payload };

  return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export default generateToken;
