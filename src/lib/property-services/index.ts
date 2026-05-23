/**
 * Property Services SDK — re-export shim.
 *
 * Now sourced from @caistech/property-services-sdk. Named exports are
 * listed explicitly because Turbopack's tree-shaker can't resolve
 * `export *` through a workspace-linked package's symlink.
 *
 * Keep this list in sync with the package's src/index.ts.
 */

export {
  PropertyServicesClient,
  PropertyServicesError,
  createPropertyServices,
  usePropertyOnboarding,
  PropertyAssessment,
} from '@caistech/property-services-sdk';

export type {
  PropertyProfile,
  NormalisedAddress,
  LotInfo,
  ZoningInfo,
  EnvironmentInfo,
  PlanningOverlay,
  SubdivisionAnalysis,
  ProfileMetadata,
  SuitabilityAssessment,
  DeriveResponse,
  AssessResponse,
  PropertyServicesConfig,
  UsePropertyOnboardingReturn,
  OnboardingStage,
} from '@caistech/property-services-sdk';
