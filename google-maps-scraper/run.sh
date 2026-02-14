#!/bin/bash
set -e

# Use environment variables or defaults
QUERIES_FILE=${QUERIES_FILE:-/data/queries.txt}
OUTPUT_FILE=${OUTPUT_FILE:-/data/output.json}
MAX_RESULTS=${MAX_RESULTS:-70}
DEPTH=${DEPTH:-1}
INACTIVITY_TIMEOUT=${INACTIVITY_TIMEOUT:-1m}

# Advanced Configs
CONCURRENCY=${CONCURRENCY:-2} # Default to 2 if not set
LANG_CODE=${LANG_CODE:-en}
ZOOM=${ZOOM:-15}

echo "Starting Google Maps scraper..."
echo "Reading queries from $QUERIES_FILE"

CMD="google-maps-scraper -input \"$QUERIES_FILE\" -results \"$OUTPUT_FILE\" -json -depth \"$DEPTH\" -exit-on-inactivity \"$INACTIVITY_TIMEOUT\" -c \"$CONCURRENCY\" -lang \"$LANG_CODE\" -zoom \"$ZOOM\""

if [ -n "$PROXIES" ]; then
    CMD="$CMD -proxies \"$PROXIES\""
    echo "Using Proxies: Yes"
fi

if [ -n "$GEO" ]; then
    CMD="$CMD -geo \"$GEO\""
fi

# Debug means "Headful" (Visible Browser). Default is Headless (Debug=false).
if [ "$DEBUG_MODE" = "true" ] || [ "$DEBUG_MODE" = "1" ]; then
    CMD="$CMD -debug"
    echo "Headless Mode: Disabled (Debug On)"
fi

echo "Detailed Command constructed."

# Run the scraper
eval $CMD

echo "SCRAPE_DONE"
echo "Results written to $OUTPUT_FILE"
