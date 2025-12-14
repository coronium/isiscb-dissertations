const express = require('express');
const { supabase } = require('../utils/db');
const { authenticateToken, requireEditor, requireViewer } = require('../middleware/auth');

const router = express.Router();

// GET /api/authorities/persons - Search persons
router.get('/persons', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        // Search in authorities_persons table
        const { data: authorities, error: authError } = await supabase
            .from('authorities_persons')
            .select('authority_id, name, birth_year, death_year, source')
            .or(`name.ilike.%${q}%,authority_id.ilike.%${q}%`)
            .limit(parseInt(limit));

        if (authError) throw authError;

        // Also search unique author names from dissertations (for those without authority records)
        const { data: dissAuthors, error: dissError } = await supabase
            .from('dissertations')
            .select('author_name, author_id, author_years')
            .ilike('author_name', `%${q}%`)
            .eq('is_deleted', false)
            .limit(parseInt(limit));

        if (dissError) throw dissError;

        // Combine and deduplicate by authority_id
        const seenIds = new Set(authorities.map(a => a.authority_id));
        const combined = [...authorities];

        for (const author of dissAuthors) {
            if (author.author_id && !seenIds.has(author.author_id)) {
                seenIds.add(author.author_id);
                combined.push({
                    authority_id: author.author_id,
                    name: author.author_name,
                    birth_year: author.author_years ? parseInt(author.author_years.split('-')[0]) : null,
                    death_year: author.author_years ? parseInt(author.author_years.split('-')[1]) : null,
                    source: 'dissertation'
                });
            }
        }

        // Sort by name
        combined.sort((a, b) => a.name.localeCompare(b.name));

        res.json(combined.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Search persons error:', error);
        res.status(500).json({ error: 'Failed to search persons' });
    }
});

// POST /api/authorities/persons - Create person authority
router.post('/persons', authenticateToken, requireEditor, async (req, res) => {
    try {
        const editor = req.user.username;
        const { name, birth_year, death_year } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Get next authority ID for this editor
        const { data: nextId, error: idError } = await supabase
            .rpc('get_next_authority_id', { p_prefix: editor });

        if (idError) throw idError;

        const authority = {
            authority_id: nextId,
            name,
            birth_year: birth_year ? parseInt(birth_year) : null,
            death_year: death_year ? parseInt(death_year) : null,
            source: 'manual',
            created_by: editor
        };

        const { data: inserted, error: insertError } = await supabase
            .from('authorities_persons')
            .insert(authority)
            .select()
            .single();

        if (insertError) throw insertError;

        res.status(201).json(inserted);
    } catch (error) {
        console.error('Create person authority error:', error);
        res.status(500).json({ error: 'Failed to create person authority' });
    }
});

// GET /api/authorities/persons/:id/dissertations - Get dissertations for person
router.get('/persons/:id/dissertations', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { id } = req.params;

        // Find dissertations where person is author
        const { data: asAuthor, error: authorError } = await supabase
            .from('dissertations')
            .select('record_id, title, year, school')
            .eq('author_id', id)
            .eq('is_deleted', false);

        if (authorError) throw authorError;

        // Find dissertations where person is advisor/committee
        const { data: asAdvisor, error: advisorError } = await supabase
            .from('dissertations')
            .select('record_id, title, year, school, author_name, advisors')
            .eq('is_deleted', false)
            .contains('advisors', [{ id }]);

        if (advisorError) throw advisorError;

        res.json({
            as_author: asAuthor,
            as_advisor: asAdvisor.map(d => ({
                ...d,
                role: d.advisors.find(a => a.id === id)?.role || 'Unknown'
            }))
        });
    } catch (error) {
        console.error('Get person dissertations error:', error);
        res.status(500).json({ error: 'Failed to get dissertations' });
    }
});

// GET /api/authorities/institutions - Search institutions
router.get('/institutions', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        // Search in authorities_institutions table
        const { data: authorities, error: authError } = await supabase
            .from('authorities_institutions')
            .select('authority_id, name, source')
            .or(`name.ilike.%${q}%,authority_id.ilike.%${q}%`)
            .limit(parseInt(limit));

        if (authError) throw authError;

        // Also search unique schools from dissertations
        const { data: dissSchools, error: dissError } = await supabase
            .from('dissertations')
            .select('school, school_id')
            .ilike('school', `%${q}%`)
            .eq('is_deleted', false)
            .limit(parseInt(limit));

        if (dissError) throw dissError;

        // Combine and deduplicate
        const seenIds = new Set(authorities.map(a => a.authority_id));
        const combined = [...authorities];

        for (const school of dissSchools) {
            if (school.school_id && !seenIds.has(school.school_id)) {
                seenIds.add(school.school_id);
                combined.push({
                    authority_id: school.school_id,
                    name: school.school,
                    source: 'dissertation'
                });
            }
        }

        // Sort by name
        combined.sort((a, b) => a.name.localeCompare(b.name));

        res.json(combined.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Search institutions error:', error);
        res.status(500).json({ error: 'Failed to search institutions' });
    }
});

// POST /api/authorities/institutions - Create institution authority
router.post('/institutions', authenticateToken, requireEditor, async (req, res) => {
    try {
        const editor = req.user.username;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Get next authority ID for this editor (institution)
        const { data: nextId, error: idError } = await supabase
            .rpc('get_next_authority_id', { p_prefix: `${editor}-INST` });

        if (idError) throw idError;

        const authority = {
            authority_id: nextId,
            name,
            source: 'manual',
            created_by: editor
        };

        const { data: inserted, error: insertError } = await supabase
            .from('authorities_institutions')
            .insert(authority)
            .select()
            .single();

        if (insertError) throw insertError;

        res.status(201).json(inserted);
    } catch (error) {
        console.error('Create institution authority error:', error);
        res.status(500).json({ error: 'Failed to create institution authority' });
    }
});

module.exports = router;
