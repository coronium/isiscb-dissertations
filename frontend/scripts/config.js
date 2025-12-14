// Configuration
const CONFIG = {
    // API URL - change for production
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
        ? 'http://localhost:3000'
        : 'https://isiscb-dissertations-api.onrender.com',

    // Predefined values
    SUBJECT_BROAD_OPTIONS: [
        'History of Science',
        'History of Medicine',
        'History of Technology',
        'Philosophy',
        'Philosophy of Science',
        'History',
        'Science',
        'Medicine',
        'Engineering',
        'Social Science',
        'Humanities',
        'Librarianship',
        'NONE'
    ],

    DEPARTMENT_BROAD_OPTIONS: [
        'History',
        'History of Science',
        'History of Medicine',
        'History and Philosophy of Science (HPS)',
        'Philosophy',
        'Science (general)',
        'Physics',
        'Chemistry',
        'Biology',
        'Medicine',
        'Engineering',
        'Sociology / STS',
        'Library Science',
        'Other',
        'Unknown'
    ],

    DEGREE_TYPE_OPTIONS: [
        'PhD', 'MD', 'MLIS', 'BPhil', 'ScD', 'MA', 'MS', 'Other'
    ],

    ADVISOR_ROLES: ['Advisor', 'Committee Member'],

    // Pagination
    DEFAULT_PAGE_SIZE: 50
};
