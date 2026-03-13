-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('carrier', 'shipper', 'admin');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'none');
CREATE TYPE shipment_status AS ENUM ('pending', 'matched', 'booked', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE capacity_status AS ENUM ('available', 'partially_booked', 'fully_booked', 'completed', 'cancelled');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    vat_number VARCHAR(50),
    registration_number VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    status verification_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    phone VARCHAR(50),
    subscription subscription_status DEFAULT 'none',
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles (for carriers)
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    license_plate VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL,
    max_weight_kg INTEGER NOT NULL,
    max_volume_m3 DECIMAL(10,2) NOT NULL,
    max_pallets INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Capacity Listings
CREATE TABLE capacity_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    origin_address TEXT NOT NULL,
    origin_lat DECIMAL(10,8) NOT NULL,
    origin_lng DECIMAL(11,8) NOT NULL,
    destination_address TEXT NOT NULL,
    destination_lat DECIMAL(10,8) NOT NULL,
    destination_lng DECIMAL(11,8) NOT NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    available_weight_kg INTEGER NOT NULL,
    available_volume_m3 DECIMAL(10,2) NOT NULL,
    available_pallets INTEGER NOT NULL,
    route_polyline TEXT, -- For map representation
    status capacity_status DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10,8) NOT NULL,
    delivery_lng DECIMAL(11,8) NOT NULL,
    cargo_weight_kg INTEGER NOT NULL,
    cargo_volume_m3 DECIMAL(10,2),
    pallet_count INTEGER,
    cargo_type VARCHAR(255),
    pickup_window_start TIMESTAMP WITH TIME ZONE,
    pickup_window_end TIMESTAMP WITH TIME ZONE,
    delivery_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status shipment_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Matches (Output from AI matching engine)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE NOT NULL,
    capacity_listing_id UUID REFERENCES capacity_listings(id) ON DELETE CASCADE NOT NULL,
    match_score INTEGER NOT NULL, -- 0-100
    detour_distance_km DECIMAL(10,2),
    added_time_minutes INTEGER,
    estimated_revenue DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'suggested', -- suggested, accepted, rejected, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings (Confirmed transports)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES shipments(id) ON DELETE RESTRICT NOT NULL,
    capacity_listing_id UUID REFERENCES capacity_listings(id) ON DELETE RESTRICT NOT NULL,
    carrier_company_id UUID REFERENCES companies(id) NOT NULL,
    shipper_company_id UUID REFERENCES companies(id) NOT NULL,
    agreed_price DECIMAL(10,2) NOT NULL,
    commission_fee DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, in_progress, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents (CMR, Invoices)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- cmr, invoice, proof_of_delivery
    file_url TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ratings
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    score INTEGER CHECK (score >= 1 AND score <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE RESTRICT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    transaction_type VARCHAR(50) NOT NULL, -- payment, commission_fee, refund
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auth Tokens
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'email_verification', 'password_reset'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Connections
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'google', 'microsoft', 'linkedin'
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);

-- User Preferences
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    whatsapp_notifications BOOLEAN DEFAULT FALSE,
    notification_frequency VARCHAR(50) DEFAULT 'instant', -- 'instant', 'daily', 'weekly'
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drivers (for carriers)
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    license_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Company Documents (for verification/registration)
CREATE TABLE company_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'registration', 'license', 'insurance'
    file_url TEXT NOT NULL,
    status verification_status DEFAULT 'pending',
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
