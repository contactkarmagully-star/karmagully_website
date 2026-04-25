# Security Specification - Zenith Metal

## 1. Data Invariants
- Products: Only admins can create, update, or delete. Anyone can read.
- Orders: 
  - Anyone can create an order.
  - Customers (if logged in) can see their own orders.
  - Admins can see all orders.
  - No one (except admins) can update an order once placed.
  - Payment status can only be updated by systems/admins.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Identity Theft):** Anonymous user trying to create a product.
   - Expected: PERMISSION_DENIED
2. **Payload 2 (Identity Theft):** Non-admin user trying to delete a product.
   - Expected: PERMISSION_DENIED
3. **Payload 3 (Integrity Breach):** Creating an order with a non-existent product ID.
   - Expected: PERMISSION_DENIED
4. **Payload 4 (Integrity Breach):** Order with negative quantity.
   - Expected: PERMISSION_DENIED
5. **Payload 5 (Identity Theft):** User trying to read someone else's order (if user ID is present).
   - Expected: PERMISSION_DENIED
6. **Payload 6 (Shadow Field):** Adding `isAdmin: true` to a user profile or order.
   - Expected: PERMISSION_DENIED
7. **Payload 7 (Resource Poisoning):** Document ID with 2KB junk characters.
   - Expected: PERMISSION_DENIED
8. **Payload 8 (State Shortcutting):** Updating order status from `Pending` directly to `Delivered` without admin rights.
   - Expected: PERMISSION_DENIED
9. **Payload 9 (PII Leak):** Reading orders list without filters.
   - Expected: PERMISSION_DENIED
10. **Payload 10 (Immutable Field):** Changing `createdAt` on an existing order.
    - Expected: PERMISSION_DENIED
11. **Payload 11 (Price Injection):** Creating an order with a price lower than the actual product price.
    - Expected: PERMISSION_DENIED (requires server-side check or exists check)
12. **Payload 12 (Denial of Wallet):** Creating an order with 10,000 items in the array.
    - Expected: PERMISSION_DENIED

## 3. Test Runner
*(Conceptual - tests to be implemented in `firestore.rules.test.ts` if possible, but here we describe the check logic)*
- `test('Anonymous cannot write products', ...)`
- `test('Customers can place orders', ...)`
- `test('Admins can manage products', ...)`
