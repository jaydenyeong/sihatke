import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import checkinRoutes from './checkins';
import contactRoutes from './contacts';
import alertRoutes from './alerts';
import pushTokenRoutes from './pushTokens';
import circleRoutes from './circle';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/checkins', checkinRoutes);
router.use('/contacts', contactRoutes);
router.use('/alerts', alertRoutes);
router.use('/push-tokens', pushTokenRoutes);
router.use('/circle', circleRoutes);

export default router;
