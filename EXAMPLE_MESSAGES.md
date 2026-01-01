# Example Messages

This file documents the example messages provided in `example-messages.json` for testing and demonstrating the WebSocket Time Machine component.

## Overview

The `example-messages.json` file contains **2,056 sample WebSocket messages** that showcase all features of the component:

- Message filtering by requestId
- Custom field filtering with nested paths
- Message grouping by requestId
- JSON viewer for complex objects
- Handling of different data types (JSON, strings, numbers)
- Performance with large datasets (5MB+ file)

## How to Use

### 1. Load Example Messages into the Component

1. Open `index.html` or `demo.html` in your browser
2. Click the **"Import Messages"** button
3. Select the `example-messages.json` file
4. The component will load all 2,056 messages

### 2. Try the Features

#### Filter by Request ID
- In the "Filter by Request ID" field, enter: `req-001`
- See only messages with that specific requestId
- Try: `req-015`, `req-100`, etc.

#### Custom Field Filtering
- Click in the "Field" input to see autocomplete suggestions
- Try these examples:
  - **Field**: `data.userId`, **Value**: `user-123` → Find messages for specific user
  - **Field**: `data.status`, **Value**: `success` → Find successful responses
  - **Field**: `data.action`, **Value**: `login` → Find login requests
  - **Field**: `type`, **Value**: `received` → Show only received messages
  - **Field**: `data.profile.role`, **Value**: `admin` → Find admin users
  - **Field**: `data.analytics.revenue`, **Value**: `1` → Find analytics with revenue data
  - **Field**: `data.metadata.version`, **Value**: `2.0.1` → Filter by version

#### Group by Request ID
- Check the "Group by Request ID" checkbox
- Messages will be grouped showing request/response pairs together
- Each group shows the requestId and message count

#### JSON Viewer
- Click the **▶** button on any message to expand
- JSON objects are formatted with 2-space indentation
- Primitive values (strings, numbers) show with type labels
- Try expanding different message types to see various JSON structures

## Message Structure

### Standard Message Format
```json
{
  "timestamp": "2026-01-01T06:00:00.000Z",
  "type": "sent|received",
  "data": "{...JSON string...}"
}
```

### Example Message Types

#### 1. Login Request/Response
**Request:**
```json
{
  "requestId": "req-001",
  "action": "login",
  "user": {
    "userId": "user-123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0"
  }
}
```

**Response:**
```json
{
  "requestId": "req-001",
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "expiresIn": 3600,
    "user": {
      "userId": "user-123",
      "name": "John Doe",
      "role": "admin"
    }
  }
}
```

#### 2. User Profile Request/Response
**Request:**
```json
{
  "requestId": "req-002",
  "action": "getUserProfile",
  "userId": "user-123",
  "includeOrders": true
}
```

**Response:**
```json
{
  "requestId": "req-002",
  "status": "success",
  "data": {
    "profile": {
      "userId": "user-123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "settings": {
        "theme": "dark",
        "notifications": true,
        "language": "en"
      },
      "stats": {
        "ordersCount": 42,
        "totalSpent": 5432.10
      }
    }
  }
}
```

#### 3. Orders Request/Response
**Request:**
```json
{
  "requestId": "req-003",
  "action": "fetchOrders",
  "filters": {
    "status": "pending",
    "limit": 50,
    "offset": 0
  }
}
```

**Response:**
```json
{
  "requestId": "req-003",
  "status": "success",
  "data": {
    "orders": [
      {
        "orderId": "ord-001",
        "amount": 99.99,
        "status": "pending",
        "customer": {
          "name": "Alice Smith",
          "email": "alice@example.com"
        },
        "items": [
          {
            "productId": "prod-100",
            "name": "Dell XPS 15",
            "quantity": 1
          }
        ]
      }
    ],
    "total": 1,
    "page": 1
  }
}
```

#### 4. Analytics Request/Response
**Request:**
```json
{
  "requestId": "req-005",
  "action": "getAnalytics",
  "period": "daily",
  "metrics": ["revenue", "orders", "users"]
}
```

**Response:**
```json
{
  "requestId": "req-005",
  "status": "success",
  "data": {
    "analytics": {
      "revenue": 15432.50,
      "orders": 87,
      "users": 245,
      "period": "2026-01-01",
      "metrics": {
        "conversionRate": 3.45,
        "avgOrderValue": 177.47,
        "returnRate": 2.30
      }
    }
  }
}
```

#### 5. Primitive Messages
The file also includes non-JSON messages:
- Simple strings: `"Simple string message without JSON structure"`
- Numbers: `"12345"`
- System messages: `"System message 50: Status check OK"`

## Message Statistics

- **Total Messages**: 2,056
- **Request/Response Pairs**: ~1,000 pairs
- **Unique Request IDs**: ~1,000
- **Message Types**:
  - Sent: ~1,000
  - Received: ~1,050
  - Primitives: ~6
- **Actions Covered**:
  - `login` / `logout`
  - `getUserProfile`
  - `fetchOrders`
  - `updateOrder`
  - `getAnalytics`
  - `searchProducts`
  - `createCart`
  - `processPayment`
  - `sendNotification`

## Nested Field Paths Available

The example messages include the following nested field paths for testing autocomplete:

- `type` - Message type (sent/received)
- `timestamp` - Message timestamp
- `data` - Raw data field
- `data.requestId` - Unique request identifier
- `data.action` - Action being performed
- `data.userId` - User identifier
- `data.status` - Response status
- `data.user.name` - User name
- `data.user.email` - User email
- `data.user.role` - User role
- `data.profile.settings.theme` - Theme setting
- `data.profile.settings.notifications` - Notification setting
- `data.profile.stats.ordersCount` - Number of orders
- `data.orders` - Order array
- `data.analytics.revenue` - Revenue metric
- `data.analytics.metrics.conversionRate` - Conversion rate
- `data.metadata.ip` - IP address
- `data.metadata.version` - API version
- `data.filters.status` - Filter status
- And many more...

## Performance Testing

This file is ideal for testing component performance:

- **File Size**: ~1.2 MB
- **Load Time**: < 1 second
- **Filtering**: Instant with pagination
- **Memory Usage**: Optimized with O(1) operations
- **Pagination**: 50 messages per page = 42 pages
- **JSON Parsing**: Lazy (only when expanding)

## Use Cases

### 1. Debug WebSocket Communication
- Load exported messages from your application
- Use filtering to find specific requests
- Group by requestId to see request/response flow
- Expand JSON to inspect data structures

### 2. Test Component Features
- Import this file to see all features in action
- Try different filter combinations
- Test performance with large datasets
- Verify JSON viewer with complex objects

### 3. Demonstrate to Stakeholders
- Show message flow visualization
- Demonstrate filtering capabilities
- Highlight request/response pairing
- Show JSON inspection capabilities

### 4. Development Testing
- Use as test data for Angular integration
- Validate filtering algorithms
- Test pagination performance
- Verify grouping logic

## Creating Your Own Example File

To create your own example messages file:

1. Connect to your WebSocket server using the component
2. Enable "Auto-capture messages"
3. Interact with your application
4. Click "Export Messages" to save
5. The exported JSON can be imported later

Or manually create a JSON array following the format:
```json
[
  {
    "timestamp": "ISO-8601 timestamp",
    "type": "sent" or "received",
    "data": "JSON string or primitive value"
  }
]
```

## Tips

- **Large Files**: The component handles 5-10 MB files efficiently
- **Filtering**: Combine requestId filter with custom field filter for precise results
- **Grouping**: Best used with requestId filtering for focused analysis
- **JSON Viewer**: Use expand/collapse to manage screen space
- **Export**: After filtering, export shows only filtered messages
