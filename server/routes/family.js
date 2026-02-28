// ============================================
// SafeLink – Family Routes
// ============================================
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const familyController = require('../controllers/familyController');

router.use(authenticate);

router.get('/', familyController.getMembers);
router.post('/', familyController.addMember);
router.delete('/:id', familyController.deleteMember);

module.exports = router;
