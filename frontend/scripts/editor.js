// Editor functionality for add/edit dissertations

const Editor = {
    mode: null, // 'add' or 'edit'
    currentRecord: null,
    advisorCount: 0,
    hasUnsavedChanges: false,
    duplicateConfirmed: false,

    init() {
        this.bindEvents();
        this.populateDropdowns();
    },

    bindEvents() {
        // Cancel buttons
        document.getElementById('cancel-btn').addEventListener('click', () => this.cancel());
        document.getElementById('cancel-btn-bottom').addEventListener('click', () => this.cancel());

        // Save buttons
        document.getElementById('save-btn').addEventListener('click', () => this.save());
        document.getElementById('save-btn-bottom').addEventListener('click', () => this.save());

        // Add advisor button
        document.getElementById('add-advisor-btn').addEventListener('click', () => this.addAdvisorRow());

        // Unknown checkboxes
        document.getElementById('title-unknown').addEventListener('change', (e) => {
            const input = document.getElementById('edit-title');
            if (e.target.checked) {
                input.value = '[unknown]';
                input.disabled = true;
            } else {
                input.value = '';
                input.disabled = false;
            }
            this.markChanged();
        });

        document.getElementById('school-unknown').addEventListener('change', (e) => {
            const input = document.getElementById('edit-school');
            if (e.target.checked) {
                input.value = '[unknown]';
                input.disabled = true;
                document.getElementById('edit-school-id').value = '';
                document.getElementById('school-selected').classList.add('hidden');
            } else {
                input.value = '';
                input.disabled = false;
            }
            this.markChanged();
        });

        // Form change tracking
        document.getElementById('dissertation-form').addEventListener('input', () => this.markChanged());

        // Autocomplete for author
        this.setupAutocomplete('author-autocomplete', 'edit-author', 'persons', (item) => {
            document.getElementById('edit-author-id').value = item.authority_id;
            document.getElementById('edit-author-years').value = item.birth_year && item.death_year
                ? `${item.birth_year}-${item.death_year}` : '';
            this.showSelectedAuthority('author-selected', item);
            this.checkForDuplicates(item.authority_id);
        });

        // Autocomplete for school
        this.setupAutocomplete('school-autocomplete', 'edit-school', 'institutions', (item) => {
            document.getElementById('edit-school-id').value = item.authority_id;
            this.showSelectedAuthority('school-selected', item);
        });

        // Modal close buttons
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-overlay').classList.add('hidden');
            });
        });

        // Delete confirmation
        document.getElementById('confirm-delete').addEventListener('click', () => {
            Search.confirmDelete();
        });

        // Duplicate confirmation
        document.getElementById('confirm-duplicate').addEventListener('click', () => {
            this.duplicateConfirmed = true;
            document.getElementById('duplicate-modal').classList.add('hidden');
        });

        // Authority creation confirmation
        document.getElementById('confirm-authority').addEventListener('click', () => {
            this.createAuthority();
        });

        // Unsaved changes warning
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    },

    populateDropdowns() {
        // Department broad - add empty first option
        const deptSelect = document.getElementById('edit-department-broad');
        const deptEmpty = document.createElement('option');
        deptEmpty.value = '';
        deptEmpty.textContent = '-- Select --';
        deptSelect.appendChild(deptEmpty);
        CONFIG.DEPARTMENT_BROAD_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            deptSelect.appendChild(option);
        });

        // Subject broad - add empty first option
        const subjectSelect = document.getElementById('edit-subject-broad');
        const subjectEmpty = document.createElement('option');
        subjectEmpty.value = '';
        subjectEmpty.textContent = '-- Select --';
        subjectSelect.appendChild(subjectEmpty);
        CONFIG.SUBJECT_BROAD_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            subjectSelect.appendChild(option);
        });
    },

    setupAutocomplete(containerId, inputId, type, onSelect) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        const dropdown = container.querySelector('.autocomplete-dropdown');

        let searchTimeout;

        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = input.value.trim();

            if (query.length < 2) {
                dropdown.classList.add('hidden');
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const results = type === 'persons'
                        ? await API.searchPersons(query)
                        : await API.searchInstitutions(query);

                    this.renderAutocompleteResults(dropdown, results, query, type, onSelect);
                } catch (error) {
                    console.error('Autocomplete error:', error);
                }
            }, 300);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => dropdown.classList.add('hidden'), 200);
        });

        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0) {
                dropdown.classList.remove('hidden');
            }
        });
    },

    renderAutocompleteResults(dropdown, results, query, type, onSelect) {
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-empty">No matches found</div>';
        } else {
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-option';
                div.innerHTML = `
                    <div>${this.escapeHtml(item.name)}</div>
                    <div class="autocomplete-option-meta">
                        ${item.authority_id}
                        ${item.birth_year ? ` (${item.birth_year}${item.death_year ? `-${item.death_year}` : ''})` : ''}
                    </div>
                `;
                div.addEventListener('mousedown', () => {
                    dropdown.closest('.autocomplete').querySelector('input').value = item.name;
                    dropdown.classList.add('hidden');
                    onSelect(item);
                });
                dropdown.appendChild(div);
            });
        }

        // Add "Create new" option
        if (Auth.isEditor()) {
            const createDiv = document.createElement('div');
            createDiv.className = 'autocomplete-create';
            createDiv.innerHTML = `+ Create new: "${this.escapeHtml(query)}"`;
            createDiv.addEventListener('mousedown', () => {
                dropdown.classList.add('hidden');
                this.showCreateAuthorityModal(query, type);
            });
            dropdown.appendChild(createDiv);
        }

        dropdown.classList.remove('hidden');
    },

    showSelectedAuthority(containerId, item) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <span>${this.escapeHtml(item.name)}</span>
            <span class="authority-id">${item.authority_id}</span>
            <button type="button" class="clear-btn" title="Clear">&times;</button>
        `;
        container.classList.remove('hidden');

        container.querySelector('.clear-btn').addEventListener('click', () => {
            container.classList.add('hidden');
            if (containerId === 'author-selected') {
                document.getElementById('edit-author-id').value = '';
                document.getElementById('edit-author-years').value = '';
            } else if (containerId === 'school-selected') {
                document.getElementById('edit-school-id').value = '';
            }
        });
    },

    showCreateAuthorityModal(name, type) {
        document.getElementById('authority-modal-title').textContent =
            type === 'persons' ? 'Create New Person Authority' : 'Create New Institution Authority';
        document.getElementById('authority-name').value = name;
        document.getElementById('authority-birth').value = '';
        document.getElementById('authority-death').value = '';

        const modal = document.getElementById('authority-modal');
        modal.dataset.type = type;
        modal.dataset.name = name;
        modal.classList.remove('hidden');
    },

    async createAuthority() {
        const modal = document.getElementById('authority-modal');
        const type = modal.dataset.type;
        const name = document.getElementById('authority-name').value;
        const birthYear = document.getElementById('authority-birth').value;
        const deathYear = document.getElementById('authority-death').value;

        try {
            let result;
            if (type === 'persons') {
                result = await API.createPerson({
                    name,
                    birth_year: birthYear || null,
                    death_year: deathYear || null
                });

                document.getElementById('edit-author').value = name;
                document.getElementById('edit-author-id').value = result.authority_id;
                document.getElementById('edit-author-years').value = birthYear && deathYear
                    ? `${birthYear}-${deathYear}` : '';
                this.showSelectedAuthority('author-selected', result);
            } else {
                result = await API.createInstitution({ name });

                document.getElementById('edit-school').value = name;
                document.getElementById('edit-school-id').value = result.authority_id;
                this.showSelectedAuthority('school-selected', result);
            }

            modal.classList.add('hidden');
        } catch (error) {
            console.error('Create authority error:', error);
            alert('Failed to create authority');
        }
    },

    async checkForDuplicates(authorId) {
        if (!authorId || this.mode === 'edit') return;

        try {
            const result = await API.getPersonDissertations(authorId);
            if (result.as_author && result.as_author.length > 0) {
                document.getElementById('duplicate-author-name').textContent =
                    `"${document.getElementById('edit-author').value}" already has:`;

                document.getElementById('duplicate-list').innerHTML = result.as_author.map(d => `
                    <div class="advisor-item">
                        "${this.escapeHtml(d.title)}" (${d.year || 'unknown'}, ${this.escapeHtml(d.school || 'unknown')})
                    </div>
                `).join('');

                document.getElementById('duplicate-modal').classList.remove('hidden');
                this.duplicateConfirmed = false;
            }
        } catch (error) {
            console.error('Check duplicates error:', error);
        }
    },

    addAdvisorRow(advisor = null) {
        const container = document.getElementById('advisors-container');
        const index = this.advisorCount++;
        const isFirst = container.children.length === 0;

        const row = document.createElement('div');
        row.className = 'advisor-row';
        row.dataset.index = index;
        row.innerHTML = `
            <div class="autocomplete advisor-autocomplete-${index}">
                <input type="text" class="autocomplete-input advisor-name" placeholder="Search by name or ID" value="${advisor ? this.escapeHtml(advisor.name) : ''}">
                <div class="autocomplete-dropdown hidden"></div>
            </div>
            <input type="hidden" class="advisor-id" value="${advisor?.id || ''}">
            <select class="form-select advisor-role">
                <option value="Advisor" ${!advisor || advisor.role === 'Advisor' ? 'selected' : ''}>Advisor</option>
                <option value="Committee Member" ${advisor?.role === 'Committee Member' ? 'selected' : ''}>Committee Member</option>
            </select>
            <button type="button" class="remove-btn" title="Remove">&times;</button>
            <label class="form-checkbox" style="margin-left: 0.5rem;">
                <input type="checkbox" class="advisor-unknown">
                [unknown]
            </label>
        `;

        // Set default role based on position
        if (!advisor && !isFirst) {
            row.querySelector('.advisor-role').value = 'Committee Member';
        }

        // Remove button
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            this.markChanged();
        });

        // Unknown checkbox
        row.querySelector('.advisor-unknown').addEventListener('change', (e) => {
            const input = row.querySelector('.advisor-name');
            if (e.target.checked) {
                input.value = '[unknown]';
                input.disabled = true;
                row.querySelector('.advisor-id').value = '';
            } else {
                input.value = '';
                input.disabled = false;
            }
            this.markChanged();
        });

        // Setup autocomplete for this advisor
        this.setupAdvisorAutocomplete(row, index);

        container.appendChild(row);
        this.markChanged();
    },

    setupAdvisorAutocomplete(row, index) {
        const input = row.querySelector('.advisor-name');
        const dropdown = row.querySelector('.autocomplete-dropdown');
        const idInput = row.querySelector('.advisor-id');

        let searchTimeout;

        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = input.value.trim();

            if (query.length < 2) {
                dropdown.classList.add('hidden');
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const results = await API.searchPersons(query);
                    this.renderAutocompleteResults(dropdown, results, query, 'persons', (item) => {
                        input.value = item.name;
                        idInput.value = item.authority_id;
                        dropdown.classList.add('hidden');
                    });
                } catch (error) {
                    console.error('Advisor autocomplete error:', error);
                }
            }, 300);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => dropdown.classList.add('hidden'), 200);
        });
    },

    showAdd() {
        this.mode = 'add';
        this.currentRecord = null;
        this.hasUnsavedChanges = false;
        this.duplicateConfirmed = false;
        this.advisorCount = 0;

        document.getElementById('editor-title').textContent = 'Add New Dissertation';
        document.getElementById('editor-user-display').textContent = Auth.getUsername();

        // Clear form
        document.getElementById('dissertation-form').reset();
        document.getElementById('edit-author-id').value = '';
        document.getElementById('edit-author-years').value = '';
        document.getElementById('edit-school-id').value = '';
        document.getElementById('author-selected').classList.add('hidden');
        document.getElementById('school-selected').classList.add('hidden');
        document.getElementById('edit-title').disabled = false;
        document.getElementById('edit-school').disabled = false;
        document.getElementById('editor-error').classList.add('hidden');

        // Clear and add one advisor row
        document.getElementById('advisors-container').innerHTML = '';
        this.addAdvisorRow();

        // Show editor page
        document.getElementById('app-page').classList.add('hidden');
        document.getElementById('editor-page').classList.remove('hidden');
    },

    showEdit(record) {
        this.mode = 'edit';
        this.currentRecord = record;
        this.hasUnsavedChanges = false;
        this.advisorCount = 0;

        document.getElementById('editor-title').textContent = 'Edit Dissertation';
        document.getElementById('editor-user-display').textContent = Auth.getUsername();
        document.getElementById('editor-error').classList.add('hidden');

        // Populate form
        document.getElementById('edit-title').value = record.title || '';
        document.getElementById('edit-title').disabled = record.title === '[unknown]';
        document.getElementById('title-unknown').checked = record.title === '[unknown]';

        document.getElementById('edit-year').value = record.year || '';
        document.getElementById('edit-date-free-text').value = record.date_free_text || '';
        document.getElementById('edit-degree-type').value = record.degree_type || 'PhD';

        document.getElementById('edit-school').value = record.school || '';
        document.getElementById('edit-school').disabled = record.school === '[unknown]';
        document.getElementById('school-unknown').checked = record.school === '[unknown]';
        document.getElementById('edit-school-id').value = record.school_id || '';

        if (record.school_id) {
            this.showSelectedAuthority('school-selected', {
                name: record.school,
                authority_id: record.school_id
            });
        } else {
            document.getElementById('school-selected').classList.add('hidden');
        }

        document.getElementById('edit-department-free').value = record.department_free_text || '';
        document.getElementById('edit-department-broad').value = record.department_broad || '';
        document.getElementById('edit-subject-broad').value = record.subject_broad || '';

        const rootRadios = document.querySelectorAll('input[name="root-dissertation"]');
        rootRadios.forEach(r => {
            r.checked = r.value === record.root_dissertation;
        });

        document.getElementById('edit-author').value = record.author_name || '';
        document.getElementById('edit-author-id').value = record.author_id || '';
        document.getElementById('edit-author-years').value = record.author_years || '';

        if (record.author_id) {
            this.showSelectedAuthority('author-selected', {
                name: record.author_name,
                authority_id: record.author_id
            });
        } else {
            document.getElementById('author-selected').classList.add('hidden');
        }

        // Populate advisors
        document.getElementById('advisors-container').innerHTML = '';
        if (record.advisors && record.advisors.length > 0) {
            record.advisors.forEach(advisor => this.addAdvisorRow(advisor));
        } else {
            this.addAdvisorRow();
        }

        document.getElementById('edit-source-notes').value = record.source_notes || '';
        document.getElementById('edit-description').value = record.description || '';
        document.getElementById('edit-language').value = record.language_code || '';
        document.getElementById('edit-pages').value = record.pages || '';

        // Show editor page
        document.getElementById('app-page').classList.add('hidden');
        document.getElementById('editor-page').classList.remove('hidden');
    },

    cancel() {
        if (this.hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                return;
            }
        }

        this.hasUnsavedChanges = false;
        document.getElementById('editor-page').classList.add('hidden');
        document.getElementById('app-page').classList.remove('hidden');
    },

    markChanged() {
        this.hasUnsavedChanges = true;
    },

    getFormData() {
        // Collect advisors
        const advisors = [];
        document.querySelectorAll('.advisor-row').forEach(row => {
            const name = row.querySelector('.advisor-name').value.trim();
            if (name) {
                advisors.push({
                    name,
                    id: row.querySelector('.advisor-id').value || null,
                    role: row.querySelector('.advisor-role').value
                });
            }
        });

        // Get root dissertation value
        const rootDiss = document.querySelector('input[name="root-dissertation"]:checked');

        return {
            title: document.getElementById('edit-title').value.trim(),
            year: document.getElementById('edit-year').value || null,
            date_free_text: document.getElementById('edit-date-free-text').value.trim() || null,
            degree_type: document.getElementById('edit-degree-type').value,
            school: document.getElementById('edit-school').value.trim(),
            school_id: document.getElementById('edit-school-id').value || null,
            department_free_text: document.getElementById('edit-department-free').value.trim() || null,
            department_broad: document.getElementById('edit-department-broad').value,
            subject_broad: document.getElementById('edit-subject-broad').value,
            root_dissertation: rootDiss ? rootDiss.value : null,
            author_name: document.getElementById('edit-author').value.trim(),
            author_id: document.getElementById('edit-author-id').value || null,
            author_years: document.getElementById('edit-author-years').value || null,
            advisors,
            source_notes: document.getElementById('edit-source-notes').value.trim(),
            description: document.getElementById('edit-description').value.trim() || null,
            language_code: document.getElementById('edit-language').value.trim() || null,
            pages: document.getElementById('edit-pages').value.trim() || null
        };
    },

    async save() {
        const errorEl = document.getElementById('editor-error');
        errorEl.classList.add('hidden');

        const data = this.getFormData();

        // Basic validation
        const errors = [];
        if (!data.author_name) errors.push('Author name is required');
        if (!data.title) errors.push('Title is required');
        if (!data.school) errors.push('School is required');
        if (!data.department_broad) errors.push('Department category is required');
        if (!data.subject_broad) errors.push('Subject is required');
        if (!data.root_dissertation) errors.push('Root dissertation selection is required');
        if (!data.source_notes) errors.push('Source notes are required');

        if (errors.length > 0) {
            errorEl.textContent = errors.join('. ');
            errorEl.classList.remove('hidden');
            window.scrollTo(0, 0);
            return;
        }

        // Check for duplicate author (for new records)
        if (this.mode === 'add' && data.author_id && !this.duplicateConfirmed) {
            try {
                const result = await API.getPersonDissertations(data.author_id);
                if (result.as_author && result.as_author.length > 0) {
                    // Show warning and return - user must confirm
                    document.getElementById('duplicate-author-name').textContent =
                        `"${data.author_name}" already has:`;

                    document.getElementById('duplicate-list').innerHTML = result.as_author.map(d => `
                        <div class="advisor-item">
                            "${this.escapeHtml(d.title)}" (${d.year || 'unknown'}, ${this.escapeHtml(d.school || 'unknown')})
                        </div>
                    `).join('');

                    document.getElementById('duplicate-modal').classList.remove('hidden');
                    return;
                }
            } catch (error) {
                console.error('Check duplicates error:', error);
            }
        }

        try {
            if (this.mode === 'add') {
                await API.createDissertation(data);
            } else {
                await API.updateDissertation(this.currentRecord.record_id, data);
            }

            this.hasUnsavedChanges = false;
            document.getElementById('editor-page').classList.add('hidden');
            document.getElementById('app-page').classList.remove('hidden');
            Search.search(Search.currentPage);
        } catch (error) {
            console.error('Save error:', error);

            if (error.requiresOverride) {
                if (confirm(`Year ${data.year} is outside the expected range (1800-${new Date().getFullYear() + 1}). Save anyway?`)) {
                    data.year_override = true;
                    return this.save();
                }
            } else {
                errorEl.textContent = error.error || 'Failed to save dissertation';
                errorEl.classList.remove('hidden');
                window.scrollTo(0, 0);
            }
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
