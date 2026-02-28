// ============================================
// SafeLink – User Controller
// ============================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getMe(req, res, next) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
    try {
        const { name, phone } = req.body;
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { ...(name && { name }), ...(phone && { phone }) },
            select: { id: true, email: true, name: true, phone: true, role: true },
        });
        res.json(user);
    } catch (err) { next(err); }
}

module.exports = { getMe, updateMe };
