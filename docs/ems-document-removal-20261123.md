# Recoverable EMS document deletion

Document administrators can delete uploaded EMS PDFs after a named confirmation. Deleted documents appear in a separate restore list. Crew and member test views have no removal or restore controls. The included refusal template remains part of the application.

Deletion writes a per-file audit marker in the existing department-scoped private storage. The original PDF stays untouched. Reads reject deleted documents, lists exclude them, and restore removes only the marker. No public file, department record, storage policy or database schema is changed. No permanent deletion control is introduced.

The actual API tests cover administrator-only deletion/restore, invalid paths, hiding deleted files and titles from crew, blocked file reads after deletion, and byte-identical restoration. Local browser checks cover Cancel, Confirm delete, Restore, crew controls, phone dark-mode readability and 820/1440-width layouts. The real assessment form is retained; live verification checks only the published controls and the preserved document.
