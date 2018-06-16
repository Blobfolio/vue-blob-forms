#!/bin/bash
#
# NPM: Uglify Tasks
#
# These are a little too cumbersome to deal with inside NPM.
##



# Check dependencies.
command -v uglifyjs >/dev/null 2>&1 || {
	echo -e "\033[31;1mError:\033[0m uglifyjs must be in \$PATH."
	echo -e "\033[96;1mFix:\033[0m npm i uglify-es -g"
	exit 1
}



declare -A SOURCES
SOURCES["dist/vue-blob-forms.min.js"]="src/js/vue-blob-forms.js"
SOURCES["demo/assets/demo.min.js"]="src/js/demo.js"

# Now loop through and compile!
for i in "${!SOURCES[@]}"
do
	echo -e "\033[2mcompiling:\033[0m $( basename "${SOURCES[$i]}" )"
	uglifyjs -c --ecma 6 -o "${i}" -- "${SOURCES[$i]}" &
done



# We've run most of these operations in parallel, but we should wait to
# exit once everything is done.
for JOB in $( jobs -p ); do
	wait $JOB || exit 1
done



# We're done!
echo -e "\033[32;1mSuccess:\033[0m Uglification has completed!"
exit 0
