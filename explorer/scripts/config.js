// Configuration for Dissertations Explorer
const CONFIG = {
    // API URL - auto-detect environment
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
        ? 'http://localhost:3000'
        : 'https://isiscb-dissertations-api.onrender.com',

    // Data snapshot path
    DATA_PATH: window.location.protocol === 'file:'
        ? './data'
        : '/data',

    // Year range bounds
    MIN_YEAR: 1878,
    MAX_YEAR: 2025,

    // Visualization defaults
    DEFAULT_GRANULARITY: 'decade',  // 'year', '5year', 'decade'
    MAX_SCHOOLS_COMPARE: 5,
    TOP_SCHOOLS_DISPLAY: 20,

    // Chart colors (matching IsisCB palette)
    COLORS: {
        primary: '#2892d7',       // Blue bell
        secondary: '#6daedb',     // Sky reflection
        tertiary: '#173753',      // Deep space blue
        accent: '#1e5f74',
        muted: '#94a3b8',
        background: '#f8fafc',
        // School comparison colors
        schools: [
            '#2892d7',  // Blue bell
            '#e74c3c',  // Red
            '#27ae60',  // Green
            '#9b59b6',  // Purple
            '#f39c12'   // Orange
        ]
    },

    // Official school colors for racing bar chart
    SCHOOL_COLORS: {
        'Harvard University': '#A51C30',                    // Harvard Crimson
        'University of Pennsylvania': '#011F5B',            // Penn Blue
        'Princeton University': '#E77500',                  // Princeton Orange
        'University of Wisconsin, Madison': '#C5050C',      // Wisconsin Cardinal
        'Columbia University': '#B9D9EB',                   // Columbia Blue
        'Yale University': '#00356B',                       // Yale Blue
        'University of Toronto': '#002A5C',                 // Toronto Blue
        'University of California, Berkeley': '#003262',    // Berkeley Blue
        'University of Chicago': '#800000',                 // Chicago Maroon
        'University of California, Los Angeles': '#2774AE', // UCLA Blue
        'Indiana University': '#990000',                    // Indiana Crimson
        'Johns Hopkins University': '#002D72',              // Hopkins Blue
        'Stanford University': '#8C1515',                   // Stanford Cardinal
        'University of Michigan': '#00274C',                // Michigan Blue
        'New York University': '#57068C',                   // NYU Violet
        'Cornell University': '#B31B1B',                    // Cornell Carnelian
        'University of Minnesota': '#7A0019',               // Minnesota Maroon
        'University of Cambridge': '#A3C1AD',               // Cambridge Green
        'University of Oxford': '#002147',                  // Oxford Blue
        'Massachusetts Institute of Technology': '#A31F34', // MIT Cardinal
        'Duke University': '#003087',                       // Duke Blue
        'University of Pittsburgh': '#003594',              // Pitt Blue
        'Brown University': '#4E3629',                      // Brown
        'Northwestern University': '#4E2A84',               // Northwestern Purple
        'University of Texas, Austin': '#BF5700',           // Texas Orange
        'University of Illinois, Urbana-Champaign': '#13294B', // Illinois Blue
        'University of Virginia': '#232D4B',                // UVA Blue
        'Georgetown University': '#041E42',                 // Georgetown Blue
        'Boston University': '#CC0000',                     // BU Red
        'Rutgers University': '#CC0033',                    // Rutgers Red
    },

    // Fallback colors for schools not in the list
    FALLBACK_SCHOOL_COLORS: [
        '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#00bcd4',
        '#4caf50', '#ff9800', '#795548', '#607d8b', '#e74c3c',
        '#2196f3', '#673ab7', '#009688', '#ff5722', '#8bc34a'
    ],

    // Predefined values (for future filtering)
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
    ]
};
