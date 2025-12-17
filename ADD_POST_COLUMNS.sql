-- Post 테이블에 images와 snsLinks 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- 1. images 컬럼 추가 (존재하지 않을 경우)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Post' AND column_name = 'images'
    ) THEN
        ALTER TABLE "Post" ADD COLUMN "images" TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Column images added to Post table';
    ELSE
        RAISE NOTICE 'Column images already exists in Post table';
    END IF;
END $$;

-- 2. snsLinks 컬럼 추가 (존재하지 않을 경우)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Post' AND column_name = 'snsLinks'
    ) THEN
        ALTER TABLE "Post" ADD COLUMN "snsLinks" TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Column snsLinks added to Post table';
    ELSE
        RAISE NOTICE 'Column snsLinks already exists in Post table';
    END IF;
END $$;

-- 3. 확인
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'Post' 
AND column_name IN ('images', 'snsLinks');
