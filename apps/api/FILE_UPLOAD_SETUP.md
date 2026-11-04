# File Upload Setup Guide

## Overview

This guide explains how to set up and use the file upload functionality for brand logos and favicons.

## Installation

### Backend Dependencies

Install required packages:

```bash
cd backend
npm install multer @types/multer
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# File upload configuration
UPLOAD_DIR=./uploads
PUBLIC_URL=http://localhost:3001
# Or for production:
# PUBLIC_URL=https://your-domain.com
```

### Directory Structure

The upload service creates the following directory structure:

```
backend/
├── uploads/
│   └── brand/
│       ├── {uuid}.png
│       ├── {uuid}.jpg
│       └── ...
```

## API Endpoints

### Upload Logo

**POST** `/api/organizations/:organizationId/brand-config/upload-logo`

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (image file)

**Response:**
```json
{
  "filename": "abc123.png",
  "originalName": "logo.png",
  "mimetype": "image/png",
  "size": 12345,
  "path": "/path/to/file",
  "url": "http://localhost:3001/uploads/brand/abc123.png",
  "config": {
    "id": "brand-123",
    "organizationId": "org-1",
    "logoUrl": "http://localhost:3001/uploads/brand/abc123.png",
    ...
  }
}
```

### Upload Favicon

**POST** `/api/organizations/:organizationId/brand-config/upload-favicon`

Same format as logo upload.

## File Validation

### Supported Formats

- **Images**: PNG, JPEG, JPG, GIF, SVG
- **Icons**: ICO, Microsoft Icon

### File Size Limits

- **Logo**: Maximum 5MB
- **Favicon**: Maximum 1MB (recommended)

### Validation Rules

- File type must match allowed MIME types
- File size must not exceed limits
- Files are validated on both client and server

## Frontend Usage

### Using FileUpload Component

```tsx
import { FileUpload } from '@/components/brand/file-upload'
import { brandConfigApi } from '@/lib/api/brand-config'

function MyComponent() {
  const handleUpload = async (file: File) => {
    const result = await brandConfigApi.uploadLogo(organizationId, file)
    return result.url
  }

  return (
    <FileUpload
      label="Upload Logo"
      accept="image/*"
      maxSize={5}
      onUpload={handleUpload}
      preview
    />
  )
}
```

### FileUpload Props

- `label`: Label text (default: "Upload File")
- `accept`: Accepted file types (default: "image/*")
- `maxSize`: Maximum file size in MB (default: 5)
- `value`: Current file URL
- `onChange`: Callback when file URL changes
- `onUpload`: Async function to upload file
- `preview`: Show image preview (default: true)
- `className`: Additional CSS classes

## Static File Serving

The backend serves uploaded files from the `uploads` directory at `/uploads/*`.

### Development

Files are served automatically via Express static middleware.

### Production

For production, you may want to:

1. **Use a CDN**: Upload files to AWS S3, Cloudinary, etc.
2. **Use Nginx**: Configure Nginx to serve static files
3. **Use Cloud Storage**: Store files in cloud storage and serve via CDN

## Security Considerations

1. **File Type Validation**: Only image files are accepted
2. **File Size Limits**: Prevents large file uploads
3. **Unique Filenames**: UUID-based filenames prevent conflicts
4. **Authentication**: Upload endpoints require JWT authentication
5. **Organization Scoping**: Files are scoped to organizations

## Storage Service

The `StorageService` handles:

- File validation
- File storage
- File deletion
- URL generation

### Custom Storage

To use cloud storage (S3, Cloudinary, etc.), extend `StorageService`:

```typescript
@Injectable()
export class CloudStorageService extends StorageService {
  async uploadFile(file: Express.Multer.File): Promise<UploadedFile> {
    // Upload to cloud storage
    const cloudUrl = await this.uploadToCloud(file)
    return {
      ...super.uploadFile(file),
      url: cloudUrl,
    }
  }
}
```

## Troubleshooting

### File Not Found (404)

**Problem**: Uploaded files return 404

**Solution**: 
1. Check `UPLOAD_DIR` environment variable
2. Ensure `uploads` directory exists
3. Verify static file serving is configured in `main.ts`

### File Too Large

**Problem**: Upload fails with "File size exceeds limit"

**Solution**: 
1. Reduce file size
2. Increase `maxSize` prop in FileUpload component
3. Update `multerConfig` limits in backend

### Invalid File Type

**Problem**: Upload fails with "Invalid file type"

**Solution**: 
1. Check file format (must be image)
2. Verify `accept` prop matches file type
3. Check `allowedMimes` in `StorageService`

## Migration from URL-based to File Upload

If you're migrating from URL-based to file upload:

1. Existing URLs continue to work
2. New uploads replace URLs with file paths
3. Both methods can be used simultaneously

## Best Practices

1. **Optimize Images**: Compress images before upload
2. **Use Appropriate Formats**: PNG for logos, ICO for favicons
3. **Set Size Limits**: Enforce reasonable file size limits
4. **CDN for Production**: Use CDN for better performance
5. **Backup Files**: Regularly backup uploaded files
6. **Cleanup Old Files**: Remove unused files periodically

## Example: Complete Upload Flow

```typescript
// 1. User selects file
const file = event.target.files[0]

// 2. Frontend validates
if (file.size > 5 * 1024 * 1024) {
  throw new Error('File too large')
}

// 3. Upload to backend
const result = await brandConfigApi.uploadLogo(orgId, file)

// 4. Backend validates and stores
// - Validates file type and size
// - Generates unique filename
// - Saves to uploads/brand/
// - Returns public URL

// 5. Update brand config
// - Logo URL is automatically updated
// - Config is returned with new URL

// 6. Frontend updates UI
// - Preview shows new logo
// - Brand config context updates
```

## Related Files

- **Backend**:
  - `src/common/storage/storage.service.ts`
  - `src/common/storage/storage.module.ts`
  - `src/common/storage/multer.config.ts`
  - `src/organizations/brand-config.controller.ts`

- **Frontend**:
  - `src/components/brand/file-upload.tsx`
  - `src/lib/api/brand-config.ts`
  - `src/app/admin/organization/brand-config/page.tsx`
