// School selector component for Dissertations Explorer

const SchoolSelector = {
    searchTimeout: null,

    init() {
        this.bindEvents();
        State.on('dataLoaded', () => this.render());
        State.on('schoolsChange', () => this.renderSelected());
    },

    bindEvents() {
        const searchInput = document.getElementById('school-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.filterSchools(e.target.value);
            }, 200);
        });

        searchInput.addEventListener('focus', () => {
            this.showList();
        });
    },

    render() {
        const schools = State.getFilteredSchools();
        if (!schools) return;

        const list = document.getElementById('school-list');
        if (!list) return;

        // Get top schools for initial display
        const topSchools = DataTransforms.getTopSchools(schools, CONFIG.TOP_SCHOOLS_DISPLAY);

        list.innerHTML = topSchools.map(school => `
            <div class="school-item" data-school="${this.escapeHtml(school.name)}">
                <input type="checkbox"
                       id="school-${this.escapeId(school.name)}"
                       ${State.selectedSchools.includes(school.name) ? 'checked' : ''}
                       ${!State.selectedSchools.includes(school.name) && State.selectedSchools.length >= CONFIG.MAX_SCHOOLS_COMPARE ? 'disabled' : ''}>
                <label for="school-${this.escapeId(school.name)}">
                    <span class="school-name">${this.escapeHtml(school.name)}</span>
                    <span class="school-count">${Formatters.number(school.count)}</span>
                </label>
            </div>
        `).join('');

        // Bind click events
        list.querySelectorAll('.school-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return; // Let checkbox handle it
                const checkbox = item.querySelector('input');
                if (!checkbox.disabled) {
                    checkbox.checked = !checkbox.checked;
                    State.toggleSchool(item.dataset.school);
                }
            });

            item.querySelector('input').addEventListener('change', (e) => {
                State.toggleSchool(item.dataset.school);
            });
        });

        this.renderSelected();
    },

    renderSelected() {
        const container = document.getElementById('selected-schools');
        if (!container) return;

        if (State.selectedSchools.length === 0) {
            container.innerHTML = '<span class="text-muted text-small">No schools selected</span>';
            return;
        }

        container.innerHTML = State.selectedSchools.map((school, index) => {
            const color = CONFIG.COLORS.schools[index];
            return `
                <span class="selected-school" style="border-color: ${color}">
                    <span class="school-color" style="background: ${color}"></span>
                    ${Formatters.schoolName(school, 25)}
                    <button class="remove-school" data-school="${this.escapeHtml(school)}">&times;</button>
                </span>
            `;
        }).join('');

        // Bind remove buttons
        container.querySelectorAll('.remove-school').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                State.toggleSchool(btn.dataset.school);
            });
        });

        // Update checkboxes in list
        const list = document.getElementById('school-list');
        if (list) {
            list.querySelectorAll('.school-item input').forEach(checkbox => {
                const schoolName = checkbox.closest('.school-item').dataset.school;
                checkbox.checked = State.selectedSchools.includes(schoolName);
                checkbox.disabled = !State.selectedSchools.includes(schoolName) &&
                                   State.selectedSchools.length >= CONFIG.MAX_SCHOOLS_COMPARE;
            });
        }
    },

    filterSchools(query) {
        const schools = State.getFilteredSchools();
        if (!schools) return;

        const list = document.getElementById('school-list');
        if (!list) return;

        let filtered;
        if (!query || query.trim() === '') {
            filtered = DataTransforms.getTopSchools(schools, CONFIG.TOP_SCHOOLS_DISPLAY);
        } else {
            const q = query.toLowerCase();
            filtered = schools
                .filter(s => s.name.toLowerCase().includes(q))
                .sort((a, b) => b.count - a.count)
                .slice(0, CONFIG.TOP_SCHOOLS_DISPLAY);
        }

        list.innerHTML = filtered.map(school => `
            <div class="school-item" data-school="${this.escapeHtml(school.name)}">
                <input type="checkbox"
                       id="school-${this.escapeId(school.name)}"
                       ${State.selectedSchools.includes(school.name) ? 'checked' : ''}
                       ${!State.selectedSchools.includes(school.name) && State.selectedSchools.length >= CONFIG.MAX_SCHOOLS_COMPARE ? 'disabled' : ''}>
                <label for="school-${this.escapeId(school.name)}">
                    <span class="school-name">${this.escapeHtml(school.name)}</span>
                    <span class="school-count">${Formatters.number(school.count)}</span>
                </label>
            </div>
        `).join('');

        // Rebind events
        list.querySelectorAll('.school-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                const checkbox = item.querySelector('input');
                if (!checkbox.disabled) {
                    checkbox.checked = !checkbox.checked;
                    State.toggleSchool(item.dataset.school);
                }
            });

            item.querySelector('input').addEventListener('change', () => {
                State.toggleSchool(item.dataset.school);
            });
        });
    },

    showList() {
        const list = document.getElementById('school-list');
        if (list) {
            list.classList.add('visible');
        }
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeId(str) {
        return str.replace(/[^a-zA-Z0-9]/g, '_');
    }
};
