# Editable Birthday Message Templates

## What will change
- Add a birthday-message editor from the home-page birthday reminder card.
- Keep one editable default blessing and allow multiple reusable named templates.
- Support a `{first_name}` placeholder so each WhatsApp message is personalised automatically.
- Let leaders choose a template before opening WhatsApp.
- Restrict template management to the admin login while all leaders can use the saved templates.

## Saving and behaviour
- Save the shared templates in the existing `Health_Config` Google Sheet settings tab so every login and device sees the same messages.
- Preserve the current blessing as the initial default when no saved settings exist.
- Validate that template names and messages are not blank, and allow non-default templates to be added, edited, and removed.
- Show clear saving and error states without changing birthday visibility or leader scoping.

## Technical details
- Extend the existing settings key/value reader and writer rather than creating another sheet tab.
- Add a small birthday-template model and helpers for parsing, serialising, placeholder replacement, and WhatsApp links.
- Update the birthday card with a template selector and an admin-only management dialog.
- Verify the app build and the mobile-width birthday workflow.
