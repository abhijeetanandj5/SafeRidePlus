// ============================================
// SafeLink – Family Members Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/family – list all family members for the logged-in user
exports.getMembers = async (req, res, next) => {
    try {
        const members = await prisma.familyMember.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'asc' },
        });
        res.json(members);
    } catch (err) { next(err); }
};

// POST /api/family – add a new family member
exports.addMember = async (req, res, next) => {
    try {
        const { name, relationship, phone, location, avatarEmoji, avatarColor } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const member = await prisma.familyMember.create({
            data: {
                userId: req.user.id,
                name: name.trim(),
                relationship: relationship || 'Other',
                phone: phone || '',
                location: location || '',
                avatarEmoji: avatarEmoji || '👤',
                avatarColor: avatarColor || '#448aff',
            },
        });
        res.status(201).json(member);
    } catch (err) { next(err); }
};

// DELETE /api/family/:id – remove a family member
exports.deleteMember = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        // Ensure member belongs to current user
        const member = await prisma.familyMember.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!member) return res.status(404).json({ error: 'Member not found' });
        await prisma.familyMember.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) { next(err); }
};
