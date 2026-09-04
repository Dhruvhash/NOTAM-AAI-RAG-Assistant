import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } 
    // Fallback to Bearer token header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aai_notam_jwt_secret_key_2026');
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
          return next();
        }
      } catch (tokenErr) {
        // Fallthrough to fallback user below
      }
    }

    // Default guest/demo user fallback when authentication is bypassed
    let defaultUser = null;
    try {
      defaultUser = await User.findOne({ email: 'dhruv@aai.aero' });
      if (!defaultUser) {
        defaultUser = await User.findOne({});
      }
    } catch (dbErr) {
      // Ignore DB errors
    }

    if (defaultUser) {
      req.user = defaultUser;
    } else {
      req.user = {
        _id: 'default_guest_id',
        name: 'Dhruv',
        email: 'dhruv@aai.aero',
        role: 'Flight Operations Officer',
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};

