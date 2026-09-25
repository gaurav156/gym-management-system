CREATE TABLE product_categories (
                                    id      UUID PRIMARY KEY,
                                    name    VARCHAR NOT NULL UNIQUE
);

-- Many-to-many: a product can sit in multiple categories, a category holds many products.
CREATE TABLE product_category_map (
                                      product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                      category_id     UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
                                      PRIMARY KEY (product_id, category_id)
);