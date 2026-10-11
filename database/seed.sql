-- =============================================================================
-- QUICKFIRE: Supabase Seed Data
-- =============================================================================

INSERT INTO questions (question_text, canonical_answer, accepted_answers, category, difficulty, image_url, image_alt_text, is_active)
VALUES
  ('What is the capital city of Australia?', 'Canberra', ARRAY['canberra'], 'Geography', 'easy', NULL, NULL, TRUE),
  ('Name the iconic landmark shown in the image located in Paris, France.', 'Eiffel Tower', ARRAY['the eiffel tower', 'tour eiffel', 'eiffel tower'], 'Geography', 'easy', 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=800&q=80', 'Iconic wrought-iron lattice tower in Paris', TRUE),
  ('Which country has the flag shown in this image?', 'Japan', ARRAY['japan', 'nippon', 'nihon'], 'Geography', 'easy', 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Flag_of_Japan.svg/800px-Flag_of_Japan.svg.png', 'White field with a central red disc', TRUE),
  ('What is the longest river in the world by general consensus?', 'Nile River', ARRAY['nile', 'the nile', 'nile river', 'river nile'], 'Geography', 'easy', NULL, NULL, TRUE),
  ('Name this ancient wonder and citadel located in Athens, Greece.', 'Acropolis', ARRAY['the acropolis', 'parthenon', 'the parthenon', 'acropolis of athens'], 'Geography', 'medium', 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80', 'Ancient Greek temple ruins on a hill in Athens', TRUE),
  ('Which country is home to the ancient rock-cut city of Petra?', 'Jordan', ARRAY['jordan', 'hashemite kingdom of jordan'], 'Geography', 'medium', NULL, NULL, TRUE),
  ('Which country’s national flag features a red maple leaf on a white and red background?', 'Canada', ARRAY['canada'], 'Geography', 'easy', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Canada_%28Pantone%29.svg/800px-Flag_of_Canada_%28Pantone%29.svg.png', 'Flag with red borders and central red maple leaf', TRUE),
  ('What black-and-white animal native to South Central China is pictured here?', 'Giant Panda', ARRAY['panda', 'giant panda', 'panda bear'], 'General Knowledge', 'easy', 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=800&q=80', 'Black and white bear eating bamboo', TRUE),
  ('How many continents are there on Earth according to the most standard model?', '7', ARRAY['7', 'seven'], 'General Knowledge', 'easy', NULL, NULL, TRUE),
  ('Name this flightless bird native to Antarctica shown in the photo.', 'Penguin', ARRAY['penguin', 'emperor penguin', 'penguins'], 'General Knowledge', 'easy', 'https://images.unsplash.com/photo-1598439210625-5067c578f3f6?auto=format&fit=crop&w=800&q=80', 'Penguin standing on ice', TRUE),
  ('What is the chemical symbol for Gold on the periodic table?', 'Au', ARRAY['au'], 'Science', 'easy', NULL, NULL, TRUE),
  ('Which planet in our solar system is known as the "Red Planet"?', 'Mars', ARRAY['mars'], 'Science', 'easy', NULL, NULL, TRUE),
  ('Identify the celestial body pictured with distinct rings.', 'Saturn', ARRAY['saturn', 'planet saturn'], 'Science', 'easy', 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&w=800&q=80', 'Ringed gas giant planet in space', TRUE),
  ('What is the powerhouse organelle of eukaryotic cells?', 'Mitochondria', ARRAY['mitochondria', 'mitochondrion'], 'Science', 'medium', NULL, NULL, TRUE),
  ('Who was the first President of the United States?', 'George Washington', ARRAY['george washington', 'washington'], 'History', 'easy', NULL, NULL, TRUE),
  ('Which ancient civilization built the Colosseum in Rome?', 'Romans', ARRAY['romans', 'roman empire', 'rome', 'ancient rome', 'the romans'], 'History', 'easy', 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80', 'Ancient Roman amphitheatre ruins in Rome', TRUE),
  ('What is the value of 12 multiplied by 12?', '144', ARRAY['144', 'one hundred forty four'], 'Mathematics', 'easy', NULL, NULL, TRUE),
  ('What is the only even prime number?', '2', ARRAY['2', 'two'], 'Mathematics', 'easy', NULL, NULL, TRUE),
  ('What is the name of Nintendo’s famous mustachioed plumber hero?', 'Mario', ARRAY['mario', 'super mario'], 'Gaming', 'easy', NULL, NULL, TRUE),
  ('Which best-selling sandbox video game features blocky terrain, Creepers, and the Ender Dragon?', 'Minecraft', ARRAY['minecraft'], 'Gaming', 'easy', NULL, NULL, TRUE),
  ('Identify this iconic gaming device released by Nintendo in 1989.', 'Game Boy', ARRAY['game boy', 'gameboy', 'original game boy'], 'Gaming', 'medium', 'https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?auto=format&fit=crop&w=800&q=80', 'Retro handheld gray gaming console with 8-bit screen', TRUE),
  ('In which sport would you perform a slam dunk?', 'Basketball', ARRAY['basketball'], 'Sports', 'easy', NULL, NULL, TRUE),
  ('Identify the sport being played with this equipment shown.', 'Tennis', ARRAY['tennis', 'lawn tennis'], 'Sports', 'easy', 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80', 'Yellow tennis ball and racket on a court', TRUE),
  ('What fictional city does Batman protect?', 'Gotham City', ARRAY['gotham', 'gotham city'], 'Entertainment', 'easy', NULL, NULL, TRUE)
ON CONFLICT DO NOTHING;
