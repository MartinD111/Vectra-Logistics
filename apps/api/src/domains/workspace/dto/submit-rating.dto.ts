import { z } from 'zod';

const criteriaScore = z.number().min(1).max(5).optional();

export const SubmitRatingSchema = z.object({
  booking_id: z.string().min(1, 'booking_id is required'),
  reviewee_id: z.string().min(1, 'reviewee_id is required'),
  score: z.number().min(1, 'score must be at least 1').max(5, 'score must be at most 5'),
  comment: z.string().optional(),
  // Extended carrier criteria (when shipper rates carrier)
  delivery_punctuality: criteriaScore,
  cargo_condition: criteriaScore,
  communication: criteriaScore,
  // Extended shipper criteria (when carrier rates shipper)
  payment_speed: criteriaScore,
  loading_conditions: criteriaScore,
  shipment_accuracy: criteriaScore,
});

export type SubmitRatingDto = z.infer<typeof SubmitRatingSchema>;
