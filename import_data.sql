SET FOREIGN_KEY_CHECKS=0;

-- Importing users
DELETE FROM users;
INSERT INTO users (id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES ('1', 'jeociyRmqij7YU3Q3qLukq', 'NaeL zzk', 'naelzzk2@gmail.com', 'google', 'admin', '2026-04-17 22:35:14', '2026-04-18 19:28:29', '2026-04-18 19:28:30');
INSERT INTO users (id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES ('60104', 'NMRVFCGTjFFCCj47fhuKAS', 'NT ZINN', 'ntzinn2010@gmail.com', 'google', 'admin', '2026-04-18 18:50:21', '2026-04-18 19:21:50', '2026-04-18 19:21:51');

-- Importing orders
DELETE FROM orders;
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('3', '#31763', 'Predador78X', 'marlonott33@gmail.com', NULL, '2.99', '0.00', '2.99', 'delivered', NULL, '2026-04-18 00:30:31', '2026-04-18 00:42:56');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('4', '#14918', 'Predador78X', 'marlonott33@gmail.com', NULL, '2.99', '0.00', '2.99', 'delivered', NULL, '2026-04-18 00:45:14', '2026-04-18 01:17:14');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('30001', '#52662', 'Predador78X', 'marlonott33@gmail.com', 'WARDEN10', '2.99', '0.30', '2.69', 'delivered', NULL, '2026-04-18 18:39:12', '2026-04-18 18:39:41');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('30002', '#60638', 'Predador78X', 'marlonott33@gmail.com', 'WARDEN10', '2.99', '0.30', '2.69', 'delivered', NULL, '2026-04-18 18:41:00', '2026-04-18 18:41:48');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('30003', '#77656', 'Predador78X', 'marlonott33@gmail.com', NULL, '35.00', '0.00', '35.00', 'delivered', NULL, '2026-04-18 18:59:37', '2026-04-18 18:59:58');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('30004', '#55562', 'Predador78X', 'marlonott33@gmail.com', NULL, '35.00', '0.00', '35.00', 'delivered', NULL, '2026-04-18 19:00:55', '2026-04-18 19:14:59');
INSERT INTO orders (id, orderNumber, minecraftNickname, email, couponCode, subtotal, discount, total, status, notes, createdAt, updatedAt) VALUES ('30005', '#40253', 'Predador78X', 'marlonott33@gmail.com', NULL, '2.99', '0.00', '2.99', 'pending_approval', NULL, '2026-04-18 19:19:00', '2026-04-18 19:19:00');

-- Importing order_items
DELETE FROM order_items;
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('3', '3', '1', 'Kit Dima', '1', '2.99', '2026-04-18 00:30:31');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('4', '4', '1', 'Kit Dima', '1', '2.99', '2026-04-18 00:45:14');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('30001', '30001', '1', 'Kit Dima', '1', '2.99', '2026-04-18 18:39:12');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('30002', '30002', '1', 'Kit Dima', '1', '2.99', '2026-04-18 18:41:00');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('30003', '30003', '30001', 'kit trio', '1', '35.00', '2026-04-18 18:59:37');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('30004', '30004', '30001', 'kit trio', '1', '35.00', '2026-04-18 19:00:55');
INSERT INTO order_items (id, orderId, productId, productName, quantity, unitPrice, createdAt) VALUES ('30005', '30005', '1', 'Kit Dima', '1', '2.99', '2026-04-18 19:19:00');

-- Importing products
DELETE FROM products;
INSERT INTO products (id, categoryId, name, description, kitContents, price, stock, imageUrl, active, createdAt, updatedAt, commands) VALUES ('1', '1', 'Kit Dima', 'O kit perfeito para quem está começando no servidor. Inclui ferramentas de ferro, comida e recursos básicos para sobreviver nos primeiros dias.', '["Espada de ferro","Picareta de ferro","Pá de ferro","32x Pão","16x Tocha","5x Poção de Cura"]', '2.99', '-1', NULL, '1', '2026-04-17 22:30:17', '2026-04-17 23:52:59', '["/execute as {player} at @s run structure load kitdima ~ ~ ~"]');
INSERT INTO products (id, categoryId, name, description, kitContents, price, stock, imageUrl, active, createdAt, updatedAt, commands) VALUES ('30001', '1', 'kit trio', NULL, NULL, '35.00', '-1', NULL, '1', '2026-04-18 18:59:09', '2026-04-18 19:00:25', '["/execute as {player} at @s run structure load kittrio ~ ~ ~"]');

-- Importing categories
DELETE FROM categories;
INSERT INTO categories (id, name, description, createdAt, updatedAt, imageUrl) VALUES ('1', 'Kits PVP', 'Kits otimizados para combate PVP no servidor.', '2026-04-17 22:30:17', '2026-04-17 23:22:02', 'https://cdn.discordapp.com/attachments/1483220774897717351/1494775922723655781/image.png?ex=69e3d60f&is=69e2848f&hm=f4d379e1e5a29235e422f83bf784f6eebe5414850a421cf384f1d60fadaf0897&');
INSERT INTO categories (id, name, description, createdAt, updatedAt, imageUrl) VALUES ('2', 'Kits Normais', 'Kits para jogadores iniciantes e intermediários.', '2026-04-17 22:30:17', '2026-04-17 23:21:48', 'https://cdn.discordapp.com/attachments/1483220774897717351/1494790103640445111/image_2.png?ex=69e3e344&is=69e291c4&hm=339466b55db54d36dca555957a07f5d28706d2fa3903d08ae51b8ea92fe0be94&');
INSERT INTO categories (id, name, description, createdAt, updatedAt, imageUrl) VALUES ('3', 'Kits Farm', 'Kits focados em farming e coleta de recursos.', '2026-04-17 22:30:17', '2026-04-17 23:21:24', 'https://cdn.discordapp.com/attachments/1483220774897717351/1494786968272506930/image_1.png?ex=69e3e059&is=69e28ed9&hm=6c64663b20e1a76e7ef39d403afa3e59e76fcf76ea96fefbd40232dbbdde8a7e&');

-- Importing coupons
DELETE FROM coupons;
INSERT INTO coupons (id, code, discountType, discountValue, active, usageCount, createdAt, updatedAt) VALUES ('1', 'WARDEN10', 'percent', '10.00', '1', '2', '2026-04-17 22:30:17', '2026-04-18 18:41:00');
INSERT INTO coupons (id, code, discountType, discountValue, active, usageCount, createdAt, updatedAt) VALUES ('2', 'BEMVINDO', 'fixed', '5.00', '1', '0', '2026-04-17 22:30:17', '2026-04-17 22:30:17');

-- Importing api_keys
DELETE FROM api_keys;
INSERT INTO api_keys (id, name, keyHash, keyPrefix, active, createdAt) VALUES ('30001', 'wardenaddon', '2be1fe80bb6dcdb11803ff53c2c60a593b6e3ad156c9eae7c02b3748f9613620', 'warden_f7lLD', '1', '2026-04-17 23:37:25');

-- Importing discord_webhooks
DELETE FROM discord_webhooks;
INSERT INTO discord_webhooks (id, type, url, active, createdAt, updatedAt) VALUES ('1', 'notification', 'https://discordapp.com/api/webhooks/1492950580669452399/T6i0IimgRG9aBpxrg11RCDpRZ_MEuOP1sVLLOjUEi4JJMyUyMXX55jUbC0IYMCkZZU1i', '1', '2026-04-18 18:40:20', '2026-04-18 18:40:20');
INSERT INTO discord_webhooks (id, type, url, active, createdAt, updatedAt) VALUES ('2', 'receipt', 'https://discordapp.com/api/webhooks/1494745459997151422/OkTfFYJozh0y0THKtSF1u5mGY-Fyqe-5dc9bKFEBE6aWqMoXD4MOa0pNlUvYBk6galy_', '1', '2026-04-18 18:40:38', '2026-04-18 18:40:38');

-- Importing site_settings
DELETE FROM site_settings;
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('1', 'storeName', 'Warden Shop', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('2', 'storeDescription', 'A loja oficial do servidor Warden Craft.', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('3', 'heroTitle', 'A Loja Oficial do Warden Craft', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('4', 'heroSubtitle', 'Adquira kits, ranks e itens exclusivos para o servidor. Entrega automática direto no seu jogo!', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('5', 'heroBgUrl', NULL, '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('6', 'logoUrl', 'https://cdn.discordapp.com/icons/1441032019684491266/a_cee2e426024714e028cdf0b940218a0b.gif?size=2048', '2026-04-17 22:49:41');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('7', 'announcementText', 'USE O CUPOM WARDEN10 E GANHE 10% OFF!', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('8', 'announcementCoupon', 'WARDEN10', '2026-04-17 22:30:17');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('30009', 'glowIntensity', '0.01', '2026-04-17 23:35:31');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('30010', 'glowColor', '#00c8c8', '2026-04-17 23:34:15');
INSERT INTO site_settings (id, key, value, updatedAt) VALUES ('30011', 'wardenGifUrl', 'https://d2xsxph8kpxj0f.cloudfront.net/310519663566472418/WbWtksiE3ubnfkNsEuG3YS/minecraft-warden_7265c060.gif', '2026-04-17 23:36:48');

SET FOREIGN_KEY_CHECKS=1;
