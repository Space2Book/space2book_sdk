<?php

declare(strict_types=1);

// Local synthetic fixture only: actual embed filter/controllers and shared services.
if (PHP_SAPI !== 'cli-server' || getenv('S2B_PUBLIC_TEST_MYSQL') !== '1') { http_response_code(403); exit; }
chdir(getenv('S2B_BACKEND_APP'));
// Keep the read-only backend checkout untouched, including runtime logs/cache.
define('WRITEPATH', getenv('S2B_SDK_TEST_WRITEPATH') . '/');
define('PUBLICPATH', getcwd() . '/private_html/');
define('SYSTEMVERSION', 'embed-browser-test');
require 'vendor/codeigniter4/framework/system/Test/bootstrap.php';

use App\Services\Security\FileStateStore;
use App\Services\Security\RateLimiter;
use Config\Services;
use Tests\Support\Embed\EmbedFixture;
use Tests\Support\PublicBooking\BookingFixture;
use Tests\Support\PublicBooking\SubmissionFixture;

foreach (['css', 'bjs', 'js', 'headers'] as $global) $GLOBALS[$global] = '';
$config = config('WebformEmbed'); $config->enabled = true;
$config->origin = 'https://api.space2book.com'; $config->signingKey = str_repeat('browser-test-only', 4);
config('App')->assetsURL = 'https://api.space2book.com/';
config('PublicBookingForm')->rateCapacity = 1000;
$policy = new \Config\SecurityProtection(); $policy->directory = WRITEPATH . 'security-state';
Services::injectMock('securityRateLimiter', new RateLimiter(new FileStateStore($policy)));
$db = SubmissionFixture::create(str_ends_with(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/submit'));  EmbedFixture::attach($db);
$db->table('integration_app_webform_settings')->update(['booking_mode' => 'quote', 'allow_catering' => 1, 'allow_facilities' => 1]);
$scenario = $_SERVER['HTTP_X_SDK_TEST_SCENARIO'] ?? '';
if ($scenario === 'inactive') $db->table('integration_connections')->update(['status' => 'inactive']);
if ($scenario === 'revoked') $db->table('integration_connections')->update(['revoked_at' => gmdate('Y-m-d H:i:s')]);
if ($scenario === 'domain') $db->table('integration_app_webform_settings')->update(['allowed_domain' => 'other.nl']);
if ($scenario === 'subscription') {
    $db->table('contracts')->update(['plan_id' => 99]);
}
Services::injectMock('publicBooking', BookingFixture::service($db));
Services::injectMock('bookingSubmission', SubmissionFixture::service($db));
$request = new \CodeIgniter\HTTP\IncomingRequest(config('App'), new \CodeIgniter\HTTP\URI('https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']), file_get_contents('php://input'), new \CodeIgniter\HTTP\UserAgent());
$request->setMethod($_SERVER['REQUEST_METHOD']); $request->setGlobal('get', $_GET);
foreach (getallheaders() as $name => $value) $request->setHeader($name, $value);
Services::injectMock('request', $request); Services::injectMock('response', Services::response(null, false));
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/bf/venue_1/house') {
    $filter = new \App\Filters\PublicBookingFormFilter();
    $response = $filter->before($request);
    if ($response === null) $response = service('response')->setBody((new \App\Services\PublicBooking\BookingFormView())->render(Services::publicBooking()->configuration('venue_1')));
    $filter->after($request, $response);
} else {
    $routes = Services::routes(false); $routes->resetRoutes(); Services::injectMock('routes', $routes);
    require APPPATH . 'Config/API/Routes.php'; $routes->setHTTPVerb($_SERVER['REQUEST_METHOD']);
    $router = new \CodeIgniter\Router\Router($routes, $request); $router->handle(ltrim($path, '/'));
    $filter = new \App\Filters\WebformEmbedFilter();
    $argument = explode(':', $router->getFilters()[0])[1];
    $response = $filter->before($request, [$argument]);
    if ($response === null) {
        $class = $router->controllerName(); $controller = new $class();
        $controller->initController($request, service('response'), new \Psr\Log\NullLogger());
        $response = $controller->{$router->methodName()}(...$router->params());
    }
    $filter->after($request, $response, [$argument]);
}
http_response_code($response->getStatusCode());
foreach ($response->headers() as $name => $header) header($name . ': ' . $header->getValueLine());
echo $response->getBody();
