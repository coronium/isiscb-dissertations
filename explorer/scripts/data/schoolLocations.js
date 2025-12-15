// Geographic coordinates for top 50 dissertation-producing institutions
// Focused on North America (US + Canada)

const SCHOOL_LOCATIONS = {
    // Top 50 schools with lat/lng coordinates
    'Harvard University': { lat: 42.3770, lng: -71.1167, city: 'Cambridge, MA' },
    'University of Pennsylvania': { lat: 39.9522, lng: -75.1932, city: 'Philadelphia, PA' },
    'Princeton University': { lat: 40.3431, lng: -74.6551, city: 'Princeton, NJ' },
    'University of Wisconsin, Madison': { lat: 43.0766, lng: -89.4125, city: 'Madison, WI' },
    'Columbia University': { lat: 40.8075, lng: -73.9626, city: 'New York, NY' },
    'Yale University': { lat: 41.3163, lng: -72.9223, city: 'New Haven, CT' },
    'University of Toronto': { lat: 43.6629, lng: -79.3957, city: 'Toronto, Canada' },
    'University of California, Berkeley': { lat: 37.8716, lng: -122.2727, city: 'Berkeley, CA' },
    'University of Chicago': { lat: 41.7886, lng: -87.5987, city: 'Chicago, IL' },
    'University of California, Los Angeles': { lat: 34.0689, lng: -118.4452, city: 'Los Angeles, CA' },
    'Indiana University': { lat: 39.1682, lng: -86.5186, city: 'Bloomington, IN' },
    'Johns Hopkins University': { lat: 39.3299, lng: -76.6205, city: 'Baltimore, MD' },
    'Stanford University': { lat: 37.4275, lng: -122.1697, city: 'Stanford, CA' },
    'University of Michigan': { lat: 42.2780, lng: -83.7382, city: 'Ann Arbor, MI' },
    'New York University': { lat: 40.7295, lng: -73.9965, city: 'New York, NY' },
    'Cornell University': { lat: 42.4534, lng: -76.4735, city: 'Ithaca, NY' },
    'University of Minnesota': { lat: 44.9740, lng: -93.2277, city: 'Minneapolis, MN' },
    'University of North Carolina at Chapel Hill': { lat: 35.9049, lng: -79.0469, city: 'Chapel Hill, NC' },
    'University of Pittsburgh': { lat: 40.4444, lng: -79.9608, city: 'Pittsburgh, PA' },
    'University of California, San Diego': { lat: 32.8801, lng: -117.2340, city: 'San Diego, CA' },
    'University of Illinois at Urbana-Champaign': { lat: 40.1020, lng: -88.2272, city: 'Urbana, IL' },
    'University of Texas, Austin': { lat: 30.2849, lng: -97.7341, city: 'Austin, TX' },
    'Rutgers University': { lat: 40.5008, lng: -74.4474, city: 'New Brunswick, NJ' },
    'New York, City University of': { lat: 40.7484, lng: -73.9832, city: 'New York, NY' },
    'Duke University': { lat: 36.0014, lng: -78.9382, city: 'Durham, NC' },
    'University of California, Santa Barbara': { lat: 34.4140, lng: -119.8489, city: 'Santa Barbara, CA' },
    'University of Washington': { lat: 47.6553, lng: -122.3035, city: 'Seattle, WA' },
    'University of California, Davis': { lat: 38.5382, lng: -121.7617, city: 'Davis, CA' },
    'University of Cambridge (UK)': { lat: 52.2043, lng: 0.1218, city: 'Cambridge, UK', exclude: true },
    'Massachusetts Institute of Technology': { lat: 42.3601, lng: -71.0942, city: 'Cambridge, MA' },
    'University of Oxford (UK)': { lat: 51.7548, lng: -1.2544, city: 'Oxford, UK', exclude: true },
    'University of Notre Dame': { lat: 41.7052, lng: -86.2352, city: 'Notre Dame, IN' },
    'Northwestern University': { lat: 42.0565, lng: -87.6753, city: 'Evanston, IL' },
    'Arizona State University': { lat: 33.4242, lng: -111.9281, city: 'Tempe, AZ' },
    'University of Iowa': { lat: 41.6611, lng: -91.5302, city: 'Iowa City, IA' },
    'University of Maryland, College Park': { lat: 38.9869, lng: -76.9426, city: 'College Park, MD' },
    'University of California, Irvine': { lat: 33.6405, lng: -117.8443, city: 'Irvine, CA' },
    'University of Oklahoma': { lat: 35.2058, lng: -97.4457, city: 'Norman, OK' },
    'Boston University': { lat: 42.3505, lng: -71.1054, city: 'Boston, MA' },
    'Pennsylvania State University': { lat: 40.7982, lng: -77.8599, city: 'State College, PA' },
    'University of Virginia': { lat: 38.0336, lng: -78.5080, city: 'Charlottesville, VA' },
    'Emory University': { lat: 33.7925, lng: -84.3232, city: 'Atlanta, GA' },
    'State University of New York at Stony Brook': { lat: 40.9126, lng: -73.1234, city: 'Stony Brook, NY' },
    'University of Southern California': { lat: 34.0224, lng: -118.2851, city: 'Los Angeles, CA' },
    'Temple University': { lat: 39.9812, lng: -75.1553, city: 'Philadelphia, PA' },
    'Brown University': { lat: 41.8268, lng: -71.4025, city: 'Providence, RI' },
    'University of Delaware': { lat: 39.6780, lng: -75.7506, city: 'Newark, DE' },
    'York University (Canada)': { lat: 43.7735, lng: -79.5019, city: 'Toronto, Canada' },
    'Florida State University': { lat: 30.4419, lng: -84.2985, city: 'Tallahassee, FL' },
    'State University of New York, Buffalo': { lat: 43.0008, lng: -78.7890, city: 'Buffalo, NY' },

    // Additional schools that might appear in top rankings over time
    'Georgetown University': { lat: 38.9076, lng: -77.0723, city: 'Washington, DC' },
    'University of Colorado': { lat: 40.0076, lng: -105.2659, city: 'Boulder, CO' },
    'Ohio State University': { lat: 40.0067, lng: -83.0305, city: 'Columbus, OH' },
    'University of Arizona': { lat: 32.2319, lng: -110.9501, city: 'Tucson, AZ' },
    'University of Kansas': { lat: 38.9543, lng: -95.2558, city: 'Lawrence, KS' },
    'Vanderbilt University': { lat: 36.1447, lng: -86.8027, city: 'Nashville, TN' },
    'Rice University': { lat: 29.7174, lng: -95.4018, city: 'Houston, TX' },
    'Washington University in St. Louis': { lat: 38.6488, lng: -90.3108, city: 'St. Louis, MO' },
    'University of Florida': { lat: 29.6436, lng: -82.3549, city: 'Gainesville, FL' },
    'Case Western Reserve University': { lat: 41.5045, lng: -81.6085, city: 'Cleveland, OH' }
};

// Get North American schools only (exclude UK)
const getNorthAmericanSchools = () => {
    return Object.entries(SCHOOL_LOCATIONS)
        .filter(([name, data]) => !data.exclude)
        .reduce((acc, [name, data]) => {
            acc[name] = data;
            return acc;
        }, {});
};
