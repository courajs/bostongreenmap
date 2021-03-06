from django.conf.urls import patterns, url

# Uncomment the next two lines to enable the admin:

urlpatterns = patterns('parkmap.views',
    # Examples:

    url(r'^park/play/$', 'play_page', name='play'),  # B  (Detail)
    url(r'^explore/$', 'explore', name='explore'),  # Explore
    url(r'^story/flag/(?P<story_id>\d+)/$', 'story_flag', name='story_flag'),
    url(r'^story/(?P<story_id>\d+)/$', 'story', name='story'),

    url(r'^park/(?P<park_slug>[-\w]+)/$', 'parks_page', name='park'),  # B  (Detail)
    url(r'^event/(?P<event_name>[-\w]+)/(?P<event_id>[-\w]+)/$', 'events', name='events'),  # B  (Detail)

    url(r'^neighborhood/(?P<n_slug>[-\w]+)/$', 'neighborhood', name='neighborhood'),  # A

    url(r'^plan/$', 'plan_a_trip', name='plan_a_trip'),  # A
    url(r'^home-search/$', 'home_search', name='home_search'),  # A
    #url(r'^plan/count/$', 'count_trip_queue', name='count_trip_queue'),  # A
    #url(r'^plan/addremove/(?P<park_id>\d+)/$', 'add_remove_park_trip_planning', name='add_remove_park_trip_planning'),  # A
    #url(r'^plan/check/(?P<park_id>\d+)/$', 'check_park_in_trip', name='check_park_in_trip'),  # A

    url(r'^neighborhood/(?P<n_slug>[-\w]+)/(?P<a_slug>[-\w]+)/$',
        'parks_in_neighborhood_with_activities',
         name='neighborhood_activities'),  # C

    url(r'^ajax/(?P<n_slug>[-\w]+)/(?P<a_slug>[-\w]+)/$', 'neighborhood_activity_ajax', name='neighborhood_actity_ajax'),  # HOME
    url(r'^$', 'home_page', name='home'),  # HOME

)
