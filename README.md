# Stickney Firehouse Manager

The Vercel-hosted Stickney portal with an embedded Inventory module at
`/inventory`.

## Inventory

- Uses the signed-in Supabase user and active Stickney department membership.
- Stores apparatus, compartments, real apparatus photos, hotspots, checks,
  work orders, equipment, and stock as durable department-scoped records.
- Starts with a truthful empty state. No demo apparatus or operational records
  are seeded.
- Stores digital-twin photos in the private
  `stickney-inventory-media` Supabase Storage bucket.
- Offers a rear-camera capture action on supported phones and iPads, with a
  file-picker fallback on desktop.

## Local verification

```powershell
npm run lint
npm test
```

The public production target is
`https://stickney-firehouse-manager.vercel.app`.
