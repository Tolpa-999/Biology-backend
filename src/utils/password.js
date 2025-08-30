import bcrypt from 'bcryptjs';
import logger from './logger.js';

const SALT_ROUNDS = 12;

// Hash password
export const hashPassword = async (password) => {
  try {
    if (!password || password.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT');
    }
    
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    
    return hash;
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('PASSWORD_HASHING_ERROR');
  }
};

// Compare password with hash
export const comparePassword = async (password, hash) => {
  try {
    if (!password || !hash) {
      return false;
    }
    
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    logger.error('Password comparison failed:', error);
    return false;
  }
};

// Validate password strength
// export const validatePasswordStrength = (password) => {
//   const minLength = 8;
//   const hasUpperCase = /[A-Z]/.test(password);
//   const hasLowerCase = /[a-z]/.test(password);
//   const hasNumbers = /\d/.test(password);
//   const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

//   return {
//     isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
//     requirements: {
//       minLength,
//       hasUpperCase,
//       hasLowerCase,
//       hasNumbers,
//       hasSpecialChar
//     }
//   };
// };