// Search and list functionality

const Search = {
    currentPage: 1,
    totalPages: 1,
    currentFilters: {},
    currentSort: 'year',
    currentOrder: 'desc',
    expandedRow: null,

    init() {
        this.bindEvents();
        this.populateFilterDropdowns();
        this.search();
    },

    bindEvents() {
        // Search inputs with debounce
        let searchTimeout;
        const triggerSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.search(), 300);
        };

        // Name search
        document.getElementById('search-input').addEventListener('input', triggerSearch);

        // Title search
        document.getElementById('title-search').addEventListener('input', triggerSearch);

        // School search with autocomplete
        this.setupSchoolAutocomplete();

        // Filter changes
        ['name-scope', 'filter-department', 'filter-subject', 'filter-root'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.search());
        });

        // Year range
        ['year-from', 'year-to'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.search());
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.prevPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());

        // Sort headers
        document.querySelectorAll('.table th.sortable').forEach(th => {
            th.addEventListener('click', () => this.toggleSort(th.dataset.sort));
        });

        // Export
        document.getElementById('export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('export-menu').classList.toggle('hidden');
        });

        document.getElementById('export-results').addEventListener('click', () => this.exportResults());
        document.getElementById('export-all').addEventListener('click', () => this.exportAll());

        // Close export menu on outside click
        document.addEventListener('click', () => {
            document.getElementById('export-menu').classList.add('hidden');
        });

        // Add button
        document.getElementById('add-btn').addEventListener('click', () => {
            Editor.showAdd();
        });

        // Clear search button
        document.getElementById('clear-search-btn').addEventListener('click', () => {
            this.clearSearch();
        });
    },

    clearSearch() {
        // Clear all search inputs
        document.getElementById('search-input').value = '';
        document.getElementById('school-search').value = '';
        document.getElementById('title-search').value = '';
        document.getElementById('name-scope').value = 'all';
        document.getElementById('filter-department').value = '';
        document.getElementById('filter-subject').value = '';
        document.getElementById('filter-root').value = 'any';
        document.getElementById('year-from').value = '';
        document.getElementById('year-to').value = '';

        // Re-run search with cleared filters
        this.search();
    },

    setupSchoolAutocomplete() {
        const input = document.getElementById('school-search');
        const container = input.closest('.autocomplete');
        const dropdown = container.querySelector('.autocomplete-dropdown');

        let searchTimeout;

        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = input.value.trim();

            if (query.length < 2) {
                dropdown.classList.add('hidden');
                // Still trigger search for empty input
                searchTimeout = setTimeout(() => this.search(), 300);
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const results = await API.suggestSchools(query);
                    this.renderSchoolSuggestions(dropdown, results, input);
                } catch (error) {
                    console.error('School autocomplete error:', error);
                }
                // Also trigger search
                this.search();
            }, 300);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => dropdown.classList.add('hidden'), 200);
        });

        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0 && input.value.length >= 2) {
                dropdown.classList.remove('hidden');
            }
        });

        // Handle enter key to search
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dropdown.classList.add('hidden');
                this.search();
            }
        });
    },

    renderSchoolSuggestions(dropdown, results, input) {
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-option';
            div.innerHTML = `
                <span>${this.escapeHtml(item.school)}</span>
                <span class="school-count">(${item.count})</span>
            `;
            div.addEventListener('mousedown', () => {
                input.value = item.school;
                dropdown.classList.add('hidden');
                this.search();
            });
            dropdown.appendChild(div);
        });

        dropdown.classList.remove('hidden');
    },

    populateFilterDropdowns() {
        // Department
        const deptSelect = document.getElementById('filter-department');
        CONFIG.DEPARTMENT_BROAD_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            deptSelect.appendChild(option);
        });

        // Subject
        const subjectSelect = document.getElementById('filter-subject');
        CONFIG.SUBJECT_BROAD_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            subjectSelect.appendChild(option);
        });
    },

    getFilters() {
        return {
            q: document.getElementById('search-input').value,
            name_scope: document.getElementById('name-scope').value,
            school_search: document.getElementById('school-search').value,
            title_search: document.getElementById('title-search').value,
            department_broad: document.getElementById('filter-department').value,
            subject_broad: document.getElementById('filter-subject').value,
            root_dissertation: document.getElementById('filter-root').value,
            year_from: document.getElementById('year-from').value,
            year_to: document.getElementById('year-to').value
        };
    },

    async search(page = 1) {
        this.currentPage = page;
        this.currentFilters = this.getFilters();

        const loading = document.getElementById('loading');
        const table = document.getElementById('results-table');
        const emptyState = document.getElementById('empty-state');
        const pagination = document.getElementById('pagination');

        loading.classList.remove('hidden');
        table.classList.add('hidden');
        emptyState.classList.add('hidden');
        pagination.classList.add('hidden');

        try {
            const params = {
                ...this.currentFilters,
                page: this.currentPage,
                limit: CONFIG.DEFAULT_PAGE_SIZE,
                sort: this.currentSort,
                order: this.currentOrder
            };

            const result = await API.searchDissertations(params);

            loading.classList.add('hidden');

            if (result.data.length === 0) {
                emptyState.classList.remove('hidden');
                document.getElementById('results-count').textContent = '0 results';
            } else {
                this.renderResults(result.data);
                this.renderPagination(result.pagination);
                table.classList.remove('hidden');
                pagination.classList.remove('hidden');

                const start = (result.pagination.page - 1) * result.pagination.limit + 1;
                const end = Math.min(start + result.data.length - 1, result.pagination.total);
                document.getElementById('results-count').textContent =
                    `Showing ${start}-${end} of ${result.pagination.total}`;
            }
        } catch (error) {
            loading.classList.add('hidden');
            console.error('Search error:', error);
            emptyState.classList.remove('hidden');
            document.querySelector('.empty-state-text').textContent = 'Error loading results';
        }
    },

    renderResults(data) {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

        data.forEach(diss => {
            // Main row
            const tr = document.createElement('tr');
            tr.dataset.id = diss.record_id;
            tr.innerHTML = `
                <td>
                    <button class="expand-btn" title="Expand">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </td>
                <td>${this.escapeHtml(diss.author_name)}</td>
                <td class="title-cell" title="${this.escapeHtml(diss.title)}">${this.escapeHtml(diss.title)}</td>
                <td>${diss.year || ''}</td>
                <td>${this.escapeHtml(diss.school || '')}</td>
            `;

            tr.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.toggleExpand(diss.record_id, diss);
                }
            });

            tr.querySelector('.expand-btn').addEventListener('click', () => {
                this.toggleExpand(diss.record_id, diss);
            });

            tbody.appendChild(tr);
        });
    },

    toggleExpand(id, diss) {
        const tbody = document.getElementById('results-body');
        const row = tbody.querySelector(`tr[data-id="${id}"]`);
        const existingExpanded = tbody.querySelector(`.expanded-row[data-parent="${id}"]`);

        // Close any other expanded rows
        tbody.querySelectorAll('.expanded-row').forEach(r => r.remove());
        tbody.querySelectorAll('.expand-btn.expanded').forEach(btn => btn.classList.remove('expanded'));

        if (existingExpanded) {
            this.expandedRow = null;
            return;
        }

        this.expandedRow = id;
        row.querySelector('.expand-btn').classList.add('expanded');

        const expandedRow = document.createElement('tr');
        expandedRow.className = 'expanded-row';
        expandedRow.dataset.parent = id;
        expandedRow.innerHTML = `
            <td colspan="5">
                <div class="expanded-content-inner">
                    <div class="expanded-grid">
                        <div class="expanded-field">
                            <div class="expanded-field-label">Full Title</div>
                            <div>${this.escapeHtml(diss.title)}</div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Author</div>
                            <div>
                                <a href="#" class="search-link" data-search="${this.escapeHtml(diss.author_name)}" data-type="name">${this.escapeHtml(diss.author_name)}</a>
                                ${diss.author_years ? `(${diss.author_years})` : ''}
                                ${diss.author_id ? this.renderAuthorityId(diss.author_id) : ''}
                            </div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Year</div>
                            <div>
                                ${diss.year || '[unknown]'}
                                ${diss.date_free_text ? ` (${this.escapeHtml(diss.date_free_text)})` : ''}
                            </div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Degree</div>
                            <div>${diss.degree_type || 'PhD'}</div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">School</div>
                            <div>
                                ${diss.school ? `<a href="#" class="search-link" data-search="${this.escapeHtml(diss.school)}" data-type="school">${this.escapeHtml(diss.school)}</a>` : '[unknown]'}
                                ${diss.school_id ? this.renderAuthorityId(diss.school_id) : ''}
                            </div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Department</div>
                            <div>
                                ${this.escapeHtml(diss.department_free_text || '')}
                                ${diss.department_broad ? `<span class="tag">${diss.department_broad}</span>` : ''}
                            </div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Subject</div>
                            <div><span class="tag">${diss.subject_broad}</span></div>
                        </div>
                        <div class="expanded-field">
                            <div class="expanded-field-label">Root Dissertation</div>
                            <div>${diss.root_dissertation}</div>
                        </div>
                    </div>
                    ${this.renderAdvisors(diss.advisors)}
                    <div class="expanded-actions">
                        ${Auth.isEditor() ? `
                            <button class="btn btn-secondary btn-sm edit-btn">Edit</button>
                            <button class="btn btn-secondary btn-sm changelog-btn">View Change Log</button>
                            <button class="btn btn-danger btn-sm delete-btn">Delete</button>
                        ` : ''}
                    </div>
                </div>
            </td>
        `;

        // Bind action buttons
        if (Auth.isEditor()) {
            expandedRow.querySelector('.edit-btn').addEventListener('click', () => {
                Editor.showEdit(diss);
            });
            expandedRow.querySelector('.changelog-btn').addEventListener('click', () => {
                this.showChangelog(diss.record_id);
            });
            expandedRow.querySelector('.delete-btn').addEventListener('click', () => {
                this.showDeleteModal(diss);
            });
        }

        // Bind search links
        expandedRow.querySelectorAll('.search-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const searchTerm = link.dataset.search;
                const searchType = link.dataset.type;

                // Clear all search fields first
                document.getElementById('search-input').value = '';
                document.getElementById('school-search').value = '';
                document.getElementById('title-search').value = '';

                // Set the appropriate search field
                if (searchType === 'school') {
                    document.getElementById('school-search').value = searchTerm;
                } else {
                    // name search (author or advisor)
                    document.getElementById('search-input').value = searchTerm;
                    document.getElementById('name-scope').value = 'all';
                }
                this.search();
            });
        });

        row.after(expandedRow);
    },

    renderAdvisors(advisors) {
        if (!advisors || advisors.length === 0) {
            return '';
        }

        const items = advisors.map(a => `
            <div class="advisor-item">
                <a href="#" class="search-link" data-search="${this.escapeHtml(a.name)}" data-type="name">${this.escapeHtml(a.name)}</a>
                ${a.id ? this.renderAuthorityId(a.id) : ''}
                <span class="advisor-role">(${a.role})</span>
            </div>
        `).join('');

        return `
            <div class="advisors-list">
                <h4>Advisors & Committee</h4>
                ${items}
            </div>
        `;
    },

    renderAuthorityId(id) {
        if (!id) return '';

        if (id.startsWith('CBA')) {
            // Link to IsisCB
            return `<a href="https://data.isiscb.org/p/isis/authority/${id}/" target="_blank" class="tag tag-outline tag-link">${id}</a>`;
        } else {
            // Non-CBA IDs are not linked
            return `<span class="tag tag-outline">${id}</span>`;
        }
    },

    renderPagination(pagination) {
        this.totalPages = pagination.totalPages;

        document.getElementById('page-info').textContent =
            `Page ${pagination.page} of ${pagination.totalPages}`;

        document.getElementById('prev-page').disabled = pagination.page <= 1;
        document.getElementById('next-page').disabled = pagination.page >= pagination.totalPages;
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.search(this.currentPage - 1);
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.search(this.currentPage + 1);
        }
    },

    toggleSort(field) {
        if (this.currentSort === field) {
            this.currentOrder = this.currentOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort = field;
            this.currentOrder = 'asc';
        }
        this.search();
    },

    async showChangelog(recordId) {
        try {
            const changelog = await API.getChangelog(recordId);
            const content = document.getElementById('changelog-content');

            if (changelog.length === 0) {
                content.innerHTML = '<p class="text-muted">No changes recorded</p>';
            } else {
                content.innerHTML = changelog.map(entry => `
                    <div class="changelog-entry">
                        <div class="changelog-header">
                            <span class="changelog-time">${new Date(entry.timestamp).toLocaleString()}</span>
                            <span class="changelog-editor">${entry.editor}</span>
                        </div>
                        <div class="changelog-changes">
                            ${this.renderChangelogChanges(entry)}
                        </div>
                    </div>
                `).join('');
            }

            document.getElementById('changelog-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading changelog:', error);
            alert('Failed to load change log');
        }
    },

    renderChangelogChanges(entry) {
        if (entry.action === 'create') {
            return '<em>Record created</em>';
        }
        if (entry.action === 'delete') {
            return `<em>Record deleted</em>${entry.reason ? `: ${this.escapeHtml(entry.reason)}` : ''}`;
        }
        if (!entry.changes) return '';

        return Object.entries(entry.changes).map(([field, change]) => `
            <div class="changelog-field">
                <strong>${field}:</strong>
                <span class="changelog-old">${this.escapeHtml(String(change.old || ''))}</span>
                &rarr;
                <span class="changelog-new">${this.escapeHtml(String(change.new || ''))}</span>
            </div>
        `).join('');
    },

    showDeleteModal(diss) {
        document.getElementById('delete-dissertation-info').textContent =
            `"${diss.title}" by ${diss.author_name} (${diss.year || 'unknown year'})`;
        document.getElementById('delete-reason').value = '';

        const modal = document.getElementById('delete-modal');
        modal.classList.remove('hidden');
        modal.dataset.recordId = diss.record_id;
    },

    async confirmDelete() {
        const modal = document.getElementById('delete-modal');
        const recordId = modal.dataset.recordId;
        const reason = document.getElementById('delete-reason').value.trim();

        if (!reason) {
            alert('Please provide a reason for deletion');
            return;
        }

        try {
            await API.deleteDissertation(recordId, reason);
            modal.classList.add('hidden');
            this.search(this.currentPage);
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete dissertation');
        }
    },

    async exportResults() {
        try {
            const response = await API.exportFiltered(this.currentFilters);
            this.downloadCsv(response);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data');
        }
    },

    async exportAll() {
        try {
            const response = await API.exportAll();
            this.downloadCsv(response);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data');
        }
    },

    async downloadCsv(response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
