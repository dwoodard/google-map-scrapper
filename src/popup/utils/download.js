export function downloadJSON(results) {
  const transformed = results.map(r => ({
    'Name': r.name,
    'Category': r.category,
    'Rating': r.rating,
    'Reviews': r.reviews,
    'Address': r.address,
    'Phone': r.phone,
    'Website': r.website,
    'Plus Code': r.plusCode,
    'Hours': r.hours,
    'Status': r.status,
    'Price Range': r.priceRange,
    'Latitude': r.latitude,
    'Longitude': r.longitude,
    'Place ID': r.placeId,
    'Maps URL': r.mapsUrl,
    'Keyword': r.keyword,
    'Captured At': r.capturedAt
  }))
  const blob = new Blob([JSON.stringify(transformed, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `maps-results-${Date.now()}.json`)
}

export function downloadCSV(results) {
  const headers = ['Name', 'Category', 'Rating', 'Reviews', 'Address', 'Phone', 'Website', 'Plus Code', 'Hours', 'Status', 'Price Range', 'Latitude', 'Longitude', 'Place ID', 'Maps URL', 'Keyword', 'Captured At']
  const fieldMap = {
    'Name': 'name',
    'Category': 'category',
    'Rating': 'rating',
    'Reviews': 'reviews',
    'Address': 'address',
    'Phone': 'phone',
    'Website': 'website',
    'Plus Code': 'plusCode',
    'Hours': 'hours',
    'Status': 'status',
    'Price Range': 'priceRange',
    'Latitude': 'latitude',
    'Longitude': 'longitude',
    'Place ID': 'placeId',
    'Maps URL': 'mapsUrl',
    'Keyword': 'keyword',
    'Captured At': 'capturedAt'
  }

  const rows = results.map(r =>
    headers.map(h => {
      const fieldName = fieldMap[h]
      const val = String(r[fieldName] || '')
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }).join(',')
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  triggerDownload(blob, `maps-results-${Date.now()}.csv`)
}

export function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
