const express = require('express');
const { supabase } = require('../utils/db');
const { authenticateToken, requireViewer } = require('../middleware/auth');

const router = express.Router();

// CSV column mapping (matches original data format)
const CSV_COLUMNS = [
    { key: 'record_id', header: 'ID' },
    { key: 'original_cb_id', header: 'Original_CB_ID' },
    { key: 'original_vieth_id', header: 'Original_Vieth_ID' },
    { key: 'author_name', header: 'Author_Name' },
    { key: 'author_years', header: 'Years' },
    { key: 'author_id', header: 'Author_ID' },
    { key: 'title', header: 'Title' },
    { key: 'year', header: 'Year' },
    { key: 'date_free_text', header: 'Date_Free_Text' },
    { key: 'degree_type', header: 'Degree_Type' },
    { key: 'school', header: 'School' },
    { key: 'school_id', header: 'School_ID' },
    { key: 'department_free_text', header: 'Department_free_text' },
    { key: 'department_broad', header: 'Department_broad_category' },
    { key: 'subject_broad', header: 'Subject_broad' },
    { key: 'root_dissertation', header: 'Root_dissertation' },
    { key: 'category', header: 'Category' },
    { key: 'category_id', header: 'Category_ID' },
    // Advisors will be expanded dynamically
    { key: 'source_notes', header: 'Source Notes' },
    { key: 'dataset', header: 'Dataset' },
    { key: 'description', header: 'Description' },
    { key: 'language_code', header: 'Language_Code' },
    { key: 'pages', header: 'Pages' },
    { key: 'vieth_url', header: 'Vieth_Url' },
    { key: 'vieth_abstract', header: 'Vieth_Abstract Note' },
    { key: 'vieth_place', header: 'Vieth_Place' },
    { key: 'vieth_extra', header: 'Vieth_Extra' },
    { key: 'vieth_metadata', header: 'Vieth_Metadata' },
    { key: 'merged_from_ids', header: 'Merged_From_IDs' }
];

// Max advisors to export (matching original format)
const MAX_ADVISORS = 8;

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function buildCSV(data) {
    // Build header row
    const headers = [...CSV_COLUMNS.map(c => c.header)];

    // Add advisor columns
    for (let i = 1; i <= MAX_ADVISORS; i++) {
        headers.push(`Advisor_Name_${i}`, `Advisor_ID_${i}`, `Advisor_Role_${i}`);
    }

    const rows = [headers.join(',')];

    // Build data rows
    for (const record of data) {
        const row = CSV_COLUMNS.map(col => escapeCSV(record[col.key]));

        // Add advisor columns
        const advisors = record.advisors || [];
        for (let i = 0; i < MAX_ADVISORS; i++) {
            if (advisors[i]) {
                row.push(
                    escapeCSV(advisors[i].name),
                    escapeCSV(advisors[i].id),
                    escapeCSV(advisors[i].role)
                );
            } else {
                row.push('', '', '');
            }
        }

        rows.push(row.join(','));
    }

    return rows.join('\n');
}

// GET /api/export/csv - Export all data
router.get('/csv', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('dissertations')
            .select('*')
            .eq('is_deleted', false)
            .order('record_id');

        if (error) throw error;

        const csv = buildCSV(data);
        const filename = `dissertations_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// POST /api/export/csv - Export filtered results
router.post('/csv', authenticateToken, requireViewer, async (req, res) => {
    try {
        const { filters = {} } = req.body;

        let query = supabase
            .from('dissertations')
            .select('*')
            .eq('is_deleted', false);

        // Apply filters
        if (filters.q) {
            query = query.or(`author_name.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
        }
        if (filters.department_broad) {
            query = query.eq('department_broad', filters.department_broad);
        }
        if (filters.subject_broad) {
            query = query.eq('subject_broad', filters.subject_broad);
        }
        if (filters.root_dissertation && filters.root_dissertation !== 'any') {
            query = query.eq('root_dissertation', filters.root_dissertation === 'yes' ? 'Yes' : 'No');
        }
        if (filters.year_from) {
            query = query.gte('year', parseInt(filters.year_from));
        }
        if (filters.year_to) {
            query = query.lte('year', parseInt(filters.year_to));
        }

        query = query.order('record_id');

        const { data, error } = await query;

        if (error) throw error;

        const csv = buildCSV(data);
        const filename = `dissertations_filtered_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

module.exports = router;
