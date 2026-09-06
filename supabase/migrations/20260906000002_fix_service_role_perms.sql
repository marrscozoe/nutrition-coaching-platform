-- Grant service_role permissions on client_grocery_lists
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON client_grocery_lists TO service_role;

-- Also grant on client_grocery_items for the new columns
GRANT ALL ON client_grocery_items TO service_role;
