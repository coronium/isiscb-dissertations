const express = require('express');
const { supabase } = require('../utils/db');
const { authenticateToken, requireEditor, requireViewer } = require('../middleware/auth');
const { SUBJECT_BROAD_OPTIONS, DEPARTMENT_BROAD_OPTIONS, ROOT_DISSERTATION_OPTIONS, DEGREE_TYPE_OPTIONS } = require('../utils/constants');

const router = express.Router();

// GET /api/dissertations - Search/list dissertations
router.get('/', authenticateToken, requireViewer, async (req, res) => {
    try {
        const {
            q,                    // Search term (for names)
            name_scope = 'all',   // all, authors, advisors_committee
            school_search,        // Separate school search
            title_search,         // Separate title search
            department_broad,
            subject_broad,
            root_dissertation,
            year_from,
            year_to,
            page = 1,
            limit = 50,
            sort = 'year',
            order = 'desc'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const pageLimit = parseInt(limit);

        // If searching "all" (authors + advisors), use the database function
        if (q && q.trim() && name_scope === 'all') {
            // Use RPC for combined author + advisor search
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('search_dissertations_combined', {
                    search_term: q.trim(),
                    p_limit: 10000,  // Get all matches first
                    p_offset: 0
                });

            if (rpcError) throw rpcError;

            // Apply additional filters in memory
            let filtered = rpcData || [];

            if (school_search) {
                const schoolLower = school_search.trim().toLowerCase();
                filtered = filtered.filter(d => d.school && d.school.toLowerCase().includes(schoolLower));
            }
            if (title_search) {
                const titleLower = title_search.trim().toLowerCase();
                filtered = filtered.filter(d => d.title && d.title.toLowerCase().includes(titleLower));
            }
            if (department_broad) {
                filtered = filtered.filter(d => d.department_broad === department_broad);
            }
            if (subject_broad) {
                filtered = filtered.filter(d => d.subject_broad === subject_broad);
            }
            if (root_dissertation && root_dissertation !== 'any') {
                const rootVal = root_dissertation === 'yes' ? 'Yes' : 'No';
                filtered = filtered.filter(d => d.root_dissertation === rootVal);
            }
            if (year_from) {
                filtered = filtered.filter(d => d.year && d.year >= parseInt(year_from));
            }
            if (year_to) {
                filtered = filtered.filter(d => d.year && d.year <= parseInt(year_to));
            }

            // Sort
            const sortField = ['year', 'author_name', 'title', 'school', 'created_at'].includes(sort) ? sort : 'year';
            filtered.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                if (order === 'asc') {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                } else {
                    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
                }
            });

            // Paginate
            const total = filtered.length;
            const paginated = filtered.slice(offset, offset + pageLimit);

            return res.json({
                data: paginated,
                pagination: {
                    page: parseInt(page),
                    limit: pageLimit,
                    total,
                    totalPages: Math.ceil(total / pageLimit)
                }
            });
        }

        // Standard query for other cases
        let query = supabase
            .from('dissertations')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false);

        // Name search (author only - advisors handled via RPC below)
        if (q && q.trim() && name_scope === 'authors') {
            query = query.ilike('author_name', `%${q.trim()}%`);
        }

        // Advisors-only search uses RPC function
        if (q && q.trim() && name_scope === 'advisors_committee') {
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('search_dissertations_advisors', {
                    search_term: q.trim(),
                    p_limit: 10000,
                    p_offset: 0
                });

            if (rpcError) throw rpcError;

            let filtered = rpcData || [];

            // Apply additional filters
            if (school_search) {
                const schoolLower = school_search.trim().toLowerCase();
                filtered = filtered.filter(d => d.school && d.school.toLowerCase().includes(schoolLower));
            }
            if (title_search) {
                const titleLower = title_search.trim().toLowerCase();
                filtered = filtered.filter(d => d.title && d.title.toLowerCase().includes(titleLower));
            }
            if (department_broad) {
                filtered = filtered.filter(d => d.department_broad === department_broad);
            }
            if (subject_broad) {
                filtered = filtered.filter(d => d.subject_broad === subject_broad);
            }
            if (root_dissertation && root_dissertation !== 'any') {
                const rootVal = root_dissertation === 'yes' ? 'Yes' : 'No';
                filtered = filtered.filter(d => d.root_dissertation === rootVal);
            }
            if (year_from) {
                filtered = filtered.filter(d => d.year && d.year >= parseInt(year_from));
            }
            if (year_to) {
                filtered = filtered.filter(d => d.year && d.year <= parseInt(year_to));
            }

            // Sort
            const sortField = ['year', 'author_name', 'title', 'school', 'created_at'].includes(sort) ? sort : 'year';
            filtered.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                if (order === 'asc') {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                } else {
                    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
                }
            });

            const total = filtered.length;
            const paginated = filtered.slice(offset, offset + pageLimit);

            return res.json({
                data: paginated,
                pagination: {
                    page: parseInt(page),
                    limit: pageLimit,
                    total,
                    totalPages: Math.ceil(total / pageLimit)
                }
            });
        }

        // Separate school search
        if (school_search) {
            query = query.ilike('school', `%${school_search.trim()}%`);
        }

        // Separate title search
        if (title_search) {
            query = query.ilike('title', `%${title_search.trim()}%`);
        }

        // Filters
        if (department_broad) {
            query = query.eq('department_broad', department_broad);
        }
        if (subject_broad) {
            query = query.eq('subject_broad', subject_broad);
        }
        if (root_dissertation && root_dissertation !== 'any') {
            query = query.eq('root_dissertation', root_dissertation === 'yes' ? 'Yes' : 'No');
        }
        if (year_from) {
            query = query.gte('year', parseInt(year_from));
        }
        if (year_to) {
            query = query.lte('year', parseInt(year_to));
        }

        // Sorting
        const validSortFields = ['year', 'author_name', 'title', 'school', 'created_at'];
        const sortField = validSortFields.includes(sort) ? sort : 'year';
        const sortOrder = order === 'asc' ? true : false;
        query = query.order(sortField, { ascending: sortOrder, nullsFirst: false });

        // Pagination
        query = query.range(offset, offset + pageLimit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            data,
            pagination: {
                page: parseInt(page),
                limit: pageLimit,
                total: count,
                totalPages: Math.ceil(count / pageLimit)
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search dissertations' });
    }
});

// GET /api/dissertations/schools/suggest - Autocomplete schools
router.get('/schools/suggest', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json([]);
        }

        const searchTerm = q.trim();

        // Get distinct schools matching the search term
        const { data, error } = await supabase
            .from('dissertations')
            .select('school')
            .ilike('school', `%${searchTerm}%`)
            .eq('is_deleted', false)
            .not('school', 'is', null)
            .limit(100);

        if (error) throw error;

        // Get unique schools and count occurrences
        const schoolCounts = {};
        data.forEach(row => {
            if (row.school) {
                schoolCounts[row.school] = (schoolCounts[row.school] || 0) + 1;
            }
        });

        // Sort by count (most common first) and return top 15
        const suggestions = Object.entries(schoolCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([school, count]) => ({ school, count }));

        res.json(suggestions);
    } catch (error) {
        console.error('School suggest error:', error);
        res.status(500).json({ error: 'Failed to get school suggestions' });
    }
});

// GET /api/dissertations/:id - Get single dissertation
router.get('/:id', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('dissertations')
            .select('*')
            .eq('record_id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Dissertation not found' });
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('Get dissertation error:', error);
        res.status(500).json({ error: 'Failed to get dissertation' });
    }
});

// POST /api/dissertations - Create dissertation
router.post('/', authenticateToken, requireEditor, async (req, res) => {
    try {
        const editor = req.user.username;
        const data = req.body;

        // Validate required fields
        const errors = [];
        const warnings = [];

        if (!data.author_name) errors.push('author_name');
        if (!data.title) errors.push('title');
        if (!data.school) errors.push('school');
        if (!data.department_broad) errors.push('department_broad');
        if (!data.subject_broad) errors.push('subject_broad');
        if (!data.root_dissertation) errors.push('root_dissertation');
        if (!data.source_notes) errors.push('source_notes');

        // Validate dropdown values
        if (data.subject_broad && !SUBJECT_BROAD_OPTIONS.includes(data.subject_broad)) {
            errors.push('subject_broad: invalid value');
        }
        if (data.department_broad && !DEPARTMENT_BROAD_OPTIONS.includes(data.department_broad)) {
            errors.push('department_broad: invalid value');
        }
        if (data.root_dissertation && !ROOT_DISSERTATION_OPTIONS.includes(data.root_dissertation)) {
            errors.push('root_dissertation: must be Yes or No');
        }
        if (data.degree_type && !DEGREE_TYPE_OPTIONS.includes(data.degree_type)) {
            errors.push('degree_type: invalid value');
        }

        // Validate year
        const currentYear = new Date().getFullYear();
        if (data.year) {
            const year = parseInt(data.year);
            if (isNaN(year)) {
                errors.push('year: must be a number');
            } else if (year < 1800 || year > currentYear + 1) {
                if (!data.year_override) {
                    warnings.push('year');
                    return res.status(400).json({
                        error: 'Year out of expected range (1800-' + (currentYear + 1) + ')',
                        warnings,
                        requiresOverride: true
                    });
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', errors });
        }

        // Generate record_id
        const { data: idResult, error: idError } = await supabase
            .rpc('generate_comb_id');

        if (idError) throw idError;

        const record_id = idResult;

        // Prepare dissertation data
        const dissertation = {
            record_id,
            author_name: data.author_name,
            author_id: data.author_id || null,
            author_years: data.author_years || null,
            title: data.title,
            year: data.year ? parseInt(data.year) : null,
            date_free_text: data.date_free_text || null,
            degree_type: data.degree_type || 'PhD',
            school: data.school,
            school_id: data.school_id || null,
            department_free_text: data.department_free_text || null,
            department_broad: data.department_broad,
            subject_broad: data.subject_broad,
            root_dissertation: data.root_dissertation,
            category: data.category || null,
            category_id: data.category_id || null,
            advisors: data.advisors || [],
            source_notes: data.source_notes,
            description: data.description || null,
            language_code: data.language_code || null,
            pages: data.pages || null,
            dataset: data.dataset || 'Manual entry',
            created_by: editor,
            updated_by: editor
        };

        // Insert dissertation
        const { data: inserted, error: insertError } = await supabase
            .from('dissertations')
            .insert(dissertation)
            .select()
            .single();

        if (insertError) throw insertError;

        // Create audit log entry
        await supabase
            .from('audit_log')
            .insert({
                record_id,
                action: 'create',
                editor,
                changes: { created: dissertation }
            });

        res.status(201).json(inserted);
    } catch (error) {
        console.error('Create dissertation error:', error);
        res.status(500).json({ error: 'Failed to create dissertation' });
    }
});

// PUT /api/dissertations/:id - Update dissertation
router.put('/:id', authenticateToken, requireEditor, async (req, res) => {
    try {
        const { id } = req.params;
        const editor = req.user.username;
        const updates = req.body;

        // Get current record
        const { data: current, error: fetchError } = await supabase
            .from('dissertations')
            .select('*')
            .eq('record_id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Dissertation not found' });
            }
            throw fetchError;
        }

        // Validate updates (same as create but optional fields)
        if (updates.subject_broad && !SUBJECT_BROAD_OPTIONS.includes(updates.subject_broad)) {
            return res.status(400).json({ error: 'Invalid subject_broad value' });
        }
        if (updates.department_broad && !DEPARTMENT_BROAD_OPTIONS.includes(updates.department_broad)) {
            return res.status(400).json({ error: 'Invalid department_broad value' });
        }

        // Calculate changes for audit log
        const changes = {};
        const allowedFields = [
            'author_name', 'author_id', 'author_years', 'title', 'year', 'date_free_text',
            'degree_type', 'school', 'school_id', 'department_free_text', 'department_broad',
            'subject_broad', 'root_dissertation', 'advisors', 'source_notes', 'description',
            'language_code', 'pages'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(current[field])) {
                changes[field] = { old: current[field], new: updates[field] };
            }
        }

        if (Object.keys(changes).length === 0) {
            return res.json(current); // No changes
        }

        // Update record
        const { data: updated, error: updateError } = await supabase
            .from('dissertations')
            .update({ ...updates, updated_by: editor })
            .eq('record_id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Create audit log entry
        await supabase
            .from('audit_log')
            .insert({
                record_id: id,
                action: 'update',
                editor,
                changes
            });

        res.json(updated);
    } catch (error) {
        console.error('Update dissertation error:', error);
        res.status(500).json({ error: 'Failed to update dissertation' });
    }
});

// DELETE /api/dissertations/:id - Soft delete dissertation
router.delete('/:id', authenticateToken, requireEditor, async (req, res) => {
    try {
        const { id } = req.params;
        const editor = req.user.username;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Deletion reason required' });
        }

        // Check record exists
        const { data: current, error: fetchError } = await supabase
            .from('dissertations')
            .select('record_id, title, author_name')
            .eq('record_id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Dissertation not found' });
            }
            throw fetchError;
        }

        // Soft delete
        const { error: updateError } = await supabase
            .from('dissertations')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: editor,
                deleted_reason: reason
            })
            .eq('record_id', id);

        if (updateError) throw updateError;

        // Create audit log entry
        await supabase
            .from('audit_log')
            .insert({
                record_id: id,
                action: 'delete',
                editor,
                reason
            });

        res.json({ message: 'Dissertation deleted', record_id: id });
    } catch (error) {
        console.error('Delete dissertation error:', error);
        res.status(500).json({ error: 'Failed to delete dissertation' });
    }
});

// GET /api/dissertations/:id/changelog - Get change log
router.get('/:id/changelog', authenticateToken, requireEditor, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .eq('record_id', id)
            .order('timestamp', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Get changelog error:', error);
        res.status(500).json({ error: 'Failed to get change log' });
    }
});

module.exports = router;
