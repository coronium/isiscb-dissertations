// Formatting utilities for Dissertations Explorer

const Formatters = {
    // Format number with commas
    number(n) {
        if (n === null || n === undefined) return '—';
        return n.toLocaleString();
    },

    // Format percentage
    percent(n, decimals = 1) {
        if (n === null || n === undefined) return '—';
        return (n * 100).toFixed(decimals) + '%';
    },

    // Format decimal
    decimal(n, decimals = 2) {
        if (n === null || n === undefined) return '—';
        return n.toFixed(decimals);
    },

    // Format date/time
    date(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format year range
    yearRange(min, max) {
        return `${min} – ${max}`;
    },

    // Format period label based on granularity
    periodLabel(item, granularity) {
        switch (granularity) {
            case 'year':
                return item.year.toString();
            case '5year':
                return item.period || `${item.start}–${item.start + 4}`;
            case 'decade':
                return item.period || `${item.start}s`;
            default:
                return item.year || item.start;
        }
    },

    // Format school name (truncate if too long)
    schoolName(name, maxLength = 30) {
        if (!name) return '—';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 3) + '...';
    },

    // Format growth rate as percentage with arrow
    growthRate(rate) {
        if (rate === null || rate === undefined) return '—';
        const arrow = rate > 0 ? '↑' : rate < 0 ? '↓' : '→';
        const sign = rate > 0 ? '+' : '';
        return `${arrow} ${sign}${(rate * 100).toFixed(1)}%`;
    },

    // Format Gini coefficient
    gini(value) {
        if (value === null || value === undefined) return '—';
        // Gini is 0-1, higher = more concentrated
        return value.toFixed(3);
    },

    // Format HHI (Herfindahl-Hirschman Index)
    hhi(value) {
        if (value === null || value === undefined) return '—';
        // HHI is 0-1, higher = more concentrated
        return value.toFixed(4);
    },

    // Get concentration interpretation
    concentrationLabel(gini) {
        if (gini === null || gini === undefined) return '';
        if (gini < 0.4) return 'Low concentration';
        if (gini < 0.6) return 'Moderate concentration';
        if (gini < 0.8) return 'High concentration';
        return 'Very high concentration';
    }
};
