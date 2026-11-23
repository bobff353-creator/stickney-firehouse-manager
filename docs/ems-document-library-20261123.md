# EMS document library

The EMS page retains the existing refusal form and now lists private uploaded PDFs. Document administrators (`policies.manage`, with `documents.view`) can add a titled PDF up to 4 MB. Reading, listing and downloading require verified department document access. Test-member views hide upload controls. Completed patient records do not belong in this reference library.

Files use unique names in the existing private firehouse-portal bucket, under the resolved department's ems-documents prefix. The server lists every storage page and accepts only generated safe filenames when reading. Uploads retain the original bytes, including fillable fields, and do not replace existing documents. No database migration or storage-policy change is required. No notification configuration changes.

The supplied EMS Patient Assessment PDF was inspected: one blank page, 134 fields, zero completed values. It is uploaded through the production UI after the application deployment; it is not added to public source.

Validation: PDF rendering and field inspection; actual API tests cover missing session, mismatched department, read/write permission, traversal rejection and byte preservation. Browser fixture covers failed upload with selected file retained, successful retry, member controls, phone/tablet/desktop and light/dark layouts. Live upload, reload persistence and downloaded-byte verification are recorded separately in local outputs.
