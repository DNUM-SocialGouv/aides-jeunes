import os

port = os.getenv('OPENFISCA_PORT', '2000')
bind = os.getenv('OPENFISCA_BIND_HOST', '127.0.0.1:' + port)
# Chien de garde : au-delà, le worker est tué et recyclé plutôt que de rester
# immobilisé — avec un pool de workers sync, chaque worker bloqué retire une
# place de concurrence à tout le cluster.
#
# Le seuil couvre le plus long appel légitime, et non le plus courant : le tracé
# d'une variable sur un axe empile 141 situations dans une seule requête. Il
# doit donc rester supérieur à OPENFISCA_BULK_TIMEOUT_MS côté Node, sans quoi
# c'est gunicorn qui interromprait un calcul que le client attend encore.
timeout = int(os.getenv('OPENFISCA_TIMEOUT') or 90)
workers = os.getenv('OPENFISCA_WORKERS', 8)

profiler = False
if profiler:
    import cProfile
    import pstats
    from io import StringIO
    import logging
    import os
    import tempfile
    import time

    def pre_request(worker, req):
        worker.start_time = time.time()
        worker.profile = cProfile.Profile()
        worker.profile.enable()
        worker.log.info("PROFILING %d: %s" % (worker.pid, req.uri))

    def post_request(worker, req, *args):
        tf = tempfile.NamedTemporaryFile(delete = False)
        worker.log.info("PROFILING RESULT %d: %s http://127.0.0.1:8081/snakeviz/%s" % (worker.pid, req.uri, tf.name))
        worker.profile.dump_stats(tf.name)
