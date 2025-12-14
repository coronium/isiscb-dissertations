#!/usr/bin/env node
/**
 * Import dissertations from CSV file
 * Run: node scripts/import-csv.js ../data/Dissertations-2025.12.14-1.csv
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Parse entire CSV content handling multi-line quoted values
function parseCSV(content) {
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (!inQuotes) {
                inQuotes = true;
            } else if (nextChar === '"') {
                // Escaped quote
                currentValue += '"';
                i++;
            } else {
                inQuotes = false;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentValue.trim());
            currentValue = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row
            if (char === '\r') i++; // Skip \n in \r\n
            currentRow.push(currentValue.trim());
            if (currentRow.some(v => v)) { // Skip empty rows
                rows.push(currentRow);
            }
            currentRow = [];
            currentValue = '';
        } else if (char === '\r' && !inQuotes) {
            // Handle standalone \r as newline
            currentRow.push(currentValue.trim());
            if (currentRow.some(v => v)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    // Don't forget last row
    if (currentValue || currentRow.length > 0) {
        currentRow.push(currentValue.trim());
        if (currentRow.some(v => v)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

// Map CSV row to database record
function mapRow(headers, values) {
    const row = {};
    headers.forEach((header, i) => {
        row[header] = values[i] || null;
    });

    // Build advisors array
    const advisors = [];
    for (let i = 1; i <= 8; i++) {
        const name = row[`Advisor_Name_${i}`];
        const id = row[`Advisor_ID_${i}`];
        const role = row[`Advisor_Role_${i}`];

        if (name && name.trim()) {
            advisors.push({
                name: name.trim(),
                id: id && id.trim() && id.trim() !== 'na' ? id.trim() : null,
                role: role && role.trim() ? role.trim() : 'Advisor'
            });
        }
    }

    // Map to database fields
    return {
        record_id: row['ID'],
        original_cb_id: row['Original_CB_ID'] || null,
        original_vieth_id: row['Original_Vieth_ID'] || null,
        author_name: row['Author_Name'],
        author_years: row['Years'] || null,
        author_id: row['Author_ID'] || null,
        title: row['Title'],
        year: row['Year'] ? parseInt(row['Year']) : null,
        school: row['School'] || null,
        school_id: row['School_ID'] || null,
        department_free_text: row['Department_free_text'] || null,
        department_broad: row['Department_broad_category'] || null,
        subject_broad: row['Subject_broad'] || null,
        root_dissertation: row['Root_dissertation'] || null,
        category: row['Category'] || null,
        category_id: row['Category_ID'] || null,
        advisors: advisors,
        source_notes: row['Source Notes'] || 'Imported from CSV',
        dataset: row['Dataset'] || 'CSV Import',
        description: row['Description'] || null,
        language_code: row['Language_Code'] || null,
        pages: row['Pages'] || null,
        vieth_url: row['Vieth_Url'] || null,
        vieth_abstract: row['Vieth_Abstract Note'] || null,
        vieth_place: row['Vieth_Place'] || null,
        vieth_extra: row['Vieth_Extra'] || null,
        vieth_metadata: row['Vieth_Metadata'] || null,
        merged_from_ids: row['Merged_From_IDs'] || null,
        created_by: 'import',
        updated_by: 'import'
    };
}

async function importCSV(filePath) {
    console.log(`Reading CSV file: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(content);

    // First row is headers
    const headers = rows[0];
    console.log(`Found ${headers.length} columns`);
    console.log(`Found ${rows.length - 1} data rows`);

    // Track duplicates
    const seenIds = new Set();
    const duplicates = [];
    const records = [];

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        const record = mapRow(headers, values);

        // Skip empty records
        if (!record.record_id || !record.author_name) {
            console.log(`Skipping row ${i}: missing ID or author name`);
            continue;
        }

        // Check for duplicates
        if (seenIds.has(record.record_id)) {
            duplicates.push(record.record_id);
            console.log(`Duplicate ID found: ${record.record_id}`);
            continue;
        }

        seenIds.add(record.record_id);
        records.push(record);
    }

    console.log(`\nPrepared ${records.length} unique records for import`);
    console.log(`Found ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`);

    // Import in batches
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('dissertations')
            .upsert(batch, { onConflict: 'record_id' })
            .select();

        if (error) {
            console.error(`Batch error at row ${i}:`, error.message);
            errors += batch.length;

            // Try individual inserts for failed batch
            for (const record of batch) {
                const { error: singleError } = await supabase
                    .from('dissertations')
                    .upsert(record, { onConflict: 'record_id' });

                if (singleError) {
                    console.error(`Error inserting ${record.record_id}:`, singleError.message);
                } else {
                    imported++;
                    errors--;
                }
            }
        } else {
            imported += batch.length;
        }

        process.stdout.write(`\rImported: ${imported} / ${records.length}`);
    }

    console.log(`\n\nImport complete!`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);
}

// Run import
const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node scripts/import-csv.js <csv-file-path>');
    process.exit(1);
}

const fullPath = path.resolve(filePath);
if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
}

importCSV(fullPath).catch(console.error);
