# Recoverable EMS document deletion

Document administrators can delete uploaded EMS PDFs after a named confirmation. Deleted documents appear in a separate restore list. Crew and member test views have no removal or restore controls. The included refusal template remains part of the application.

Deletion moves the original PDF into a recovery folder inside the same department-scoped private storage. Its bytes stay intact. Reads through the former link fail, active lists exclude it, and restore moves it back. The existing bucket accepts only images and PDFs, so this uses its supported PDF move operation without changing MIME restrictions. No public file, department record, storage policy or database schema is changed. No permanent deletion control is introduced.

The actual API tests cover administrator-only deletion/restore, invalid paths, hiding deleted files and titles from crew, blocked file reads after deletion, and byte-identical restoration. Local browser checks cover Cancel, Confirm delete, Restore, crew controls, phone dark-mode readability and 820/1440-width layouts. The real assessment form is retained; live verification checks only the published controls and the preserved document.
