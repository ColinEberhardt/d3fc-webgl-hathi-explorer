import pyarrow as pa
import pyarrow.compute as pc
from pyarrow import csv, fs
from pathlib import Path


source_path = Path("data.tsv")
temp_path = Path("data-filtered.tsv")
target_path = Path("data.arrows")


with open(source_path) as source:
    with open(temp_path, "w") as target:
        for source_line in source:
            if source_line.count("\t") != 8:
                # filter out records with anomalous columns
                # matches the hack in streaming-tsv-parser.js:27
                continue
            target.write(source_line)

table = csv.read_csv(
    temp_path,
    parse_options=csv.ParseOptions(
        delimiter="\t",
    ),
    convert_options=pa.csv.ConvertOptions(
        column_types={
            "date": pa.uint32(),
            "x": pa.float32(),
            "y": pa.float32(),
            "ix": pa.uint32(),
            "language": pa.dictionary(pa.int32(), pa.utf8())
        },
        null_values=["None", ""]
    ),
)

# remove unused columns
table = table.select(["ix", "x", "y", "title", "first_author_name", "date", "language"])

# truncate the title after 101 characters (matching display logic)
truncated_title = pc.utf8_replace_slice(table.column("title"), start=101, stop=1000, replacement="")
table = table.set_column(table.schema.get_field_index("title"), "title", truncated_title)

# ensure all dictionaries in the file use the same key/value mappings
table = table.unify_dictionaries()

# filter out non-numeric dates (e.g. null, "1850-1853")
# matches the hack in index.js:37
mask = pc.invert(pc.is_null(table.column("date")))
table = table.filter(mask)

# sorting by the date improves the loading aesthetics
# comment this out to exactly match the original appearance
indices = pc.sort_indices(table, sort_keys=[("date", "ascending")])
table = pc.take(table, indices)

# after sorting replace ix with an accurate row index
indices = pc.sort_indices(table, sort_keys=[("date", "ascending")])
table = table.set_column(table.schema.get_field_index("ix"), "ix", pc.cast(indices, pa.uint32()))

temp_path.unlink()

local = fs.LocalFileSystem()

with local.open_output_stream(str(target_path)) as file:
    with pa.RecordBatchStreamWriter(file, table.schema) as writer:
        writer.write_table(table, 10000)
